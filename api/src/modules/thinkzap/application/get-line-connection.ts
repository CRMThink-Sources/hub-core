import {
  AplicationContext,
  GetAplicationContext,
} from '@/modules/application/application/get-aplication-context'
import { LineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import { WhatsAppConnectorProvider } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import type {
  InstanceDataResponse,
  PhoneDataResponse,
} from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { apiLogger } from '@/shared/infra/logger'
import { DisconnectExpiredLine } from './disconnect-expired-line'
import {
  findItemInContext,
  findLineInContext,
  findOfficialLineInContext,
} from './helpers/resolve-line-by-subscription-item'

/**
 * Leitura combinada do estado da conexão de uma linha, discriminada por provider.
 *
 * `instance` carrega `token` (é a resposta crua da Z-API) — por isso o resultado
 * deste caso de uso **não** pode ser serializado direto. Quem decide o que sai é
 * o mapper de apresentação.
 *
 * A `entitlement` está nos dois braços porque a leitura passa mesmo bloqueada — o
 * cliente tem que conseguir ver o que tinha — e é ela que faz a aba esconder a
 * ação de conectar em vez de oferecer algo que a rota recusa.
 */
export type ZApiLineConnectionReading = {
  provider: 'ZAPI'
  instance: InstanceDataResponse
  /** `null` quando não conectado, ou quando a leitura do aparelho degradou. */
  phone: PhoneDataResponse | null
  entitlement: LineEntitlement
}

export type OfficialLineConnectionReading = {
  provider: 'HUBMESSAGE'
  connected: boolean
  /** `null` enquanto o cliente não concluiu o embedded signup da Meta. */
  wabaId: string | null
  entitlement: LineEntitlement
}

export type LineConnectionReading =
  | ZApiLineConnectionReading
  | OfficialLineConnectionReading

export class GetLineConnection {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
    /**
     * A leitura da aba Conexão é o outro caminho que percebe a expiração — e o
     * primeiro, para quem abriu a tela em vez de receber mensagem.
     *
     * É por isso que uma leitura pode tocar o provider. Custo aceito porque o
     * disparo não é esperado: ver `DisconnectExpiredLine.schedule`.
     */
    private readonly disconnectExpiredLine: DisconnectExpiredLine,
    /**
     * Só o status: a derivação por agregado de WABA já vive no adapter, e
     * reimplementá-la aqui faria a aba de conexão e a listagem de conectores
     * discordarem na tela.
     */
    private readonly hubMessageProvider: Pick<
      WhatsAppConnectorProvider,
      'getConnectionStatus'
    >,
  ) {}

  async execute(input: {
    subscriptionItemId: string
    domainId: string
    appCode: string
  }): Promise<LineConnectionReading> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    /**
     * O provider decide o caminho antes de qualquer resolução de credencial:
     * `findLineInContext` recusa tudo que não é Z-API, e chamá-lo primeiro faria a
     * linha oficial responder "operação indisponível" na própria aba dela.
     */
    const item = findItemInContext(context, input.subscriptionItemId)

    if (item.metadata.provider === 'HUBMESSAGE') {
      return this.readOfficial(context, input.subscriptionItemId)
    }

    return this.readZApi(context, input.subscriptionItemId)
  }

  /** Caminho Z-API: o estado vem do provider ao vivo, nunca do banco. */
  private async readZApi(
    context: AplicationContext,
    subscriptionItemId: string,
  ): Promise<ZApiLineConnectionReading> {
    const line = findLineInContext(context, subscriptionItemId)

    /**
     * Antes da leitura da Z-API, e sem `await`: a resposta não espera o
     * `disconnect`, e o estado que ela devolve é o que o provider disser agora —
     * ainda conectado, se a desconexão não tiver terminado. Na leitura seguinte
     * aparece desconectado, e é honesto nas duas.
     */
    this.disconnectExpiredLine.schedule(line.item, line.entitlement)

    /**
     * Falha aqui **não** degrada. Sem esta leitura não se sabe se a linha está
     * conectada, e responder "desconectada" mandaria o usuário ler um QR code
     * desnecessário. O erro sobe e o controller responde `502`.
     */
    const instance = await this.zApiClient.getInstance(
      line.zApiInstanceId,
      line.zApiInstanceToken,
    )

    /**
     * Só quando conectado, e degradando: dados do aparelho são cosméticos.
     * `getPhoneData` já devolve `null` em falha em vez de lançar.
     */
    const phone = instance.connected
      ? await this.zApiClient.getPhoneData(
          line.zApiInstanceId,
          line.zApiInstanceToken,
        )
      : null

    return { provider: 'ZAPI', instance, phone, entitlement: line.entitlement }
  }

  /**
   * Caminho HubMessage: a WABA do item é a âncora.
   *
   * Sem WABA não há o que consultar — o canal existe desde o provisionamento, mas
   * número conectado é o que o embedded signup produz —, então a leitura responde
   * desconectada sem gastar requisição no provider.
   *
   * **Falha na consulta degrada para conectada**, e é diferente do caminho Z-API de
   * propósito: lá a única fonte é o provider, e responder "desconectada" mandaria o
   * cliente ler um QR code inútil; aqui existe fonte local — a WABA só é gravada
   * depois de uma conexão concluída —, e usá-la é mais honesto que um `502` que
   * esconde uma linha que está no ar.
   */
  private async readOfficial(
    context: AplicationContext,
    subscriptionItemId: string,
  ): Promise<OfficialLineConnectionReading> {
    const line = findOfficialLineInContext(context, subscriptionItemId)

    if (!line.wabaId) {
      return {
        provider: 'HUBMESSAGE',
        connected: false,
        wabaId: null,
        entitlement: line.entitlement,
      }
    }

    const status = await this.hubMessageProvider.getConnectionStatus({
      instanceId: line.channelId,
      channelId: line.channelId,
      wabaId: line.wabaId,
    })

    if (!status.available) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          itemId: subscriptionItemId,
          channelId: line.channelId,
          wabaId: line.wabaId,
        },
        'HubMessage: status ao vivo indisponível — conexão da linha derivada da WABA gravada no item',
      )
    }

    return {
      provider: 'HUBMESSAGE',
      connected: status.available ? status.connected : true,
      wabaId: line.wabaId,
      entitlement: line.entitlement,
    }
  }
}
