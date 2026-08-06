import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { ConnectorStatusRef } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { apiLogger } from '@/shared/infra/logger'
import {
  assertLineEnabled,
  findConnectorLineInContext,
} from './helpers/resolve-line-by-subscription-item'

/**
 * O mínimo que o widget precisa para avisar o operador — dois booleanos.
 *
 * Nada de `instance`, aparelho ou credencial: `LineConnectionReading.instance` é a
 * resposta crua da Z-API e carrega `token`, e esta rota é aberta a qualquer usuário
 * Bitrix com JWT. O shape próprio é a defesa.
 */
export type WidgetLineStatus = {
  connected: boolean
  /** `false` quando a leitura ao provider falhou — não é o mesmo que desconectada. */
  available: boolean
}

/**
 * Status de conexão de **uma** linha, para o widget avisar na seleção.
 *
 * Casca fina de propósito, e não um reuso de `GetLineConnection`: aquela agenda
 * `DisconnectExpiredLine.schedule` como efeito de leitura — trocar de linha num
 * select não pode agendar desconexão — e devolve instância crua e aparelho, dado que
 * o widget não usa.
 *
 * **Provider-aware.** Antes daqui saía `ZApiClient.getInstance` direto, e a linha era
 * resolvida por `findLineInContext`, que recusa HubMessage: linha oficial respondia
 * `400` e o widget não tinha como avisar nada sobre ela — o que virou lacuna quando o
 * widget passou a enviar template por essas linhas. A leitura agora passa por
 * `WhatsAppConnectorProvider.getConnectionStatus`, que já é neutro entre providers
 * (Z-API pela instância, HubMessage pelo agregado da WABA).
 */
export class GetLineStatusForWidget {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly providerResolver: ConnectorProviderResolver,
  ) {}

  async execute(input: {
    subscriptionItemId: string
    domainId: string
    appCode: string
  }): Promise<WidgetLineStatus> {
    const context = await this.getAplicationContext.execute({
      domainId: input.domainId,
      appCode: input.appCode,
    })

    /**
     * Habilitação antes da conexão, como no envio: linha de trial vencido não envia
     * mesmo conectada, e responder "conectada" descreveria errado o estado.
     */
    assertLineEnabled(context, input.subscriptionItemId, new Date())

    /**
     * `findConnectorLineInContext` e não `findLineInContext`: aceita os dois providers
     * e recusa só `NONE` — item de cobrança sem conector, que não é linha.
     */
    const item = findConnectorLineInContext(context, input.subscriptionItemId)

    try {
      const provider = this.providerResolver.resolve(
        item.metadata.provider === 'HUBMESSAGE'
          ? ConnectorProvider.HUBMESSAGE
          : ConnectorProvider.ZAPI,
      )

      const status = await provider.getConnectionStatus(statusRef(item))

      return { connected: status.connected, available: status.available }
    } catch (error) {
      /**
       * Falha de leitura degrada para `available: false` em vez de subir e virar
       * `502`: o chamador precisa distinguir "está desconectada" (avisa) de "não deu
       * para saber" (não avisa), e o comportamento correto nos dois casos é
       * diferente. Divergência consciente de `GetLineConnection`, onde a leitura é a
       * razão da tela existir.
       *
       * `getConnectionStatus` já promete não lançar por falha de provider; o `catch`
       * cobre o resolver — provider sem configuração de ambiente lança aqui, e "não
       * deu para saber" descreve isso melhor que erro na cara do operador.
       */
      apiLogger.warn(
        { err: error, subscriptionItemId: input.subscriptionItemId },
        'Falha ao ler o status da linha para o widget',
      )

      return { connected: false, available: false }
    }
  }
}

/** Referência de status a partir do item — cada provider consome o que lhe cabe. */
function statusRef(item: SubscriptionItem): ConnectorStatusRef {
  if (item.metadata.provider === 'HUBMESSAGE') {
    return {
      /**
       * Para HubMessage o identificador do provider é o canal, então ele serve nos
       * dois campos — mesma convenção de `ensureLineInstance`.
       */
      instanceId: item.metadata.hubmessageChannelId,
      channelId: item.metadata.hubmessageChannelId,
      wabaId: item.metadata.wabaId ?? null,
    }
  }

  if (item.metadata.provider === 'ZAPI') {
    return {
      instanceId: item.metadata.zApiInstanceId,
      zApiToken: item.metadata.zApiInstanceToken,
    }
  }

  // `findConnectorLineInContext` já recusou `NONE` antes de chegar aqui.
  throw new Error('Linha sem provider para leitura de status')
}
