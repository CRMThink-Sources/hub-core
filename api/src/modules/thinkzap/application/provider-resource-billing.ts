import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { ConnectorResourceRef } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Ciclo de **cobrança do recurso no provider** — eixo separado da sessão do
 * WhatsApp do cliente.
 *
 * ```
 * assinatura paga              → subscribe    (o provider passa a nos cobrar)
 * assinatura cancelada         → unsubscribe  (para de cobrar)
 * entitlement bloqueado
 *   ...terminal                → disconnect   (não é daqui: é do bloqueio)
 *   ...transitório (past_due)  → nada no provider
 * ```
 *
 * **`unsubscribe` não desconecta e não destrói:** agenda o cancelamento para o fim
 * do período de assinatura. Três consequências que moldam o resto:
 *
 * 1. O recurso continua vivo no provider até o vencimento, mesmo com a linha já
 *    bloqueada no app. O bloqueio é imediato; a cobrança termina no ciclo.
 * 2. Reativar dentro do período custa **só um `subscribe`** — sem provisionar de
 *    novo, sem QR code novo.
 * 3. A operação é segura de repetir e segura de errar, o que a diferencia de
 *    `disconnect`, que custa ao cliente uma releitura de QR.
 *
 * **Trial nunca desassina**, porque nunca assinou (decisão 4 de
 * `add-connector-trial`). Trial expirado continua em `disconnect`.
 *
 * **A modalidade manual não tem gatilho aqui.** O ciclo dela é mantido por
 * automação fora do produto; quem chama estas operações é o handler dos eventos do
 * gateway, e só ele.
 */

/** Motivo enviado ao provider no cancelamento. Texto fixo: o campo é livre lá. */
const CANCELLATION_REASON = 'Assinatura cancelada no ThinkZap'

/** Por que uma operação de provider não aconteceu. */
type SkipReason =
  /** Item de cobrança sem conector: não há recurso a assinar. */
  'no-provider-credential'

type BillingOperation = 'subscribe' | 'unsubscribe'

export class ProviderResourceBilling {
  constructor(private readonly providerResolver: ConnectorProviderResolver) {}

  /**
   * Assina o recurso da linha no provider.
   *
   * **Nunca lança.** Chamada depois de as escritas na SPA concluírem: nesse ponto
   * o cliente pagou e a linha funciona, então falhar aqui é problema de operação
   * — nossa relação de cobrança com o provider — e não de produto. Propagar
   * trocaria um chamado interno por um cliente sem serviço.
   */
  async subscribe(item: SubscriptionItem): Promise<void> {
    await this.run('subscribe', item)
  }

  /**
   * Desassina o recurso da linha no provider.
   *
   * **Nunca lança**, e a falha é registrada em `error` — não `warn`. Recurso não
   * desassinado é continuar pagando ao provider por cliente que saiu: perda direta
   * de dinheiro que ninguém abre chamado por, então o log é o único lugar onde
   * aparece.
   *
   * Falhar aqui **não** desfaz o cancelamento na SPA: a linha continua bloqueada.
   */
  async unsubscribe(item: SubscriptionItem): Promise<void> {
    await this.run('unsubscribe', item)
  }

  private async run(
    operation: BillingOperation,
    item: SubscriptionItem,
  ): Promise<void> {
    const resolved = this.resolveResource(item)

    if ('skip' in resolved) {
      /**
       * Registrado, não silencioso: item sem credencial num fluxo de cobrança é
       * estado que alguém precisa ver — ou é linha nunca provisionada, ou é
       * credencial perdida.
       */
      apiLogger.warn(
        {
          app: 'thinkzap',
          operation,
          subscriptionItemId: item.id,
          reason: resolved.skip,
        },
        'Operação de cobrança no provider não tentada: item sem credencial de provider',
      )
      return
    }

    const { provider, ref, resourceId } = resolved

    try {
      const adapter = this.providerResolver.resolve(provider)

      if (operation === 'subscribe') {
        await adapter.subscribe(ref)
      } else {
        await adapter.unsubscribe(ref, CANCELLATION_REASON)
      }
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkzap',
          operation,
          subscriptionItemId: item.id,
          provider,
          resourceId,
          err: error,
        },
        operation === 'subscribe'
          ? 'Falha ao assinar o recurso no provider — a ativação segue válida e o recurso fica não assinado'
          : 'Falha ao desassinar o recurso no provider — continuamos sendo cobrados por cliente que saiu',
      )
    }
  }

  /**
   * O adapter e a referência que **aquele** provider exige.
   *
   * Z-API opera por instância + token; HubMessage por canal. A referência é
   * montada aqui e não no adapter porque é o formato do contrato neutro
   * (`ConnectorResourceRef`) que muda de significado entre os dois.
   */
  private resolveResource(item: SubscriptionItem):
    | {
        provider: ConnectorProvider
        ref: ConnectorResourceRef
        resourceId: string
      }
    | { skip: SkipReason } {
    const { metadata } = item

    if (metadata.provider === 'ZAPI') {
      return {
        provider: ConnectorProvider.ZAPI,
        ref: {
          instanceId: metadata.zApiInstanceId,
          zApiToken: metadata.zApiInstanceToken,
        },
        resourceId: metadata.zApiInstanceId,
      }
    }

    if (metadata.provider === 'HUBMESSAGE') {
      return {
        provider: ConnectorProvider.HUBMESSAGE,
        ref: {
          instanceId: metadata.hubmessageChannelId,
          channelId: metadata.hubmessageChannelId,
        },
        resourceId: metadata.hubmessageChannelId,
      }
    }

    return { skip: 'no-provider-credential' }
  }
}
