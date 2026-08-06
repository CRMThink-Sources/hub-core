import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { LineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import type {
  InstanceDataResponse,
  PhoneDataResponse,
} from '@/modules/thinkzap/infra/clients/types/z-api.types'
import { DisconnectExpiredLine } from './disconnect-expired-line'
import { resolveLineBySubscriptionItem } from './helpers/resolve-line-by-subscription-item'

/**
 * Leitura combinada do estado da conexão de uma linha.
 *
 * `instance` carrega `token` (é a resposta crua da Z-API) — por isso o resultado
 * deste caso de uso **não** pode ser serializado direto. Quem decide o que sai é
 * o mapper de apresentação.
 */
export type LineConnectionReading = {
  instance: InstanceDataResponse
  /** `null` quando não conectado, ou quando a leitura do aparelho degradou. */
  phone: PhoneDataResponse | null
  /**
   * Habilitação da linha. A leitura passa mesmo bloqueada — o cliente tem que
   * conseguir ver o que tinha — e é isto que faz a aba esconder o QR code em vez de
   * oferecer um pareamento que a rota recusa.
   */
  entitlement: LineEntitlement
}

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
  ) {}

  async execute(input: {
    subscriptionItemId: string
    domainId: string
    appCode: string
  }): Promise<LineConnectionReading> {
    const line = await resolveLineBySubscriptionItem(
      input,
      this.getAplicationContext,
    )

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

    return { instance, phone, entitlement: line.entitlement }
  }
}
