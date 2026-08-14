import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { ConnectorResourceRef } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '../errors/catalog'

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
 * **O estado da assinatura manual não tem gatilho aqui.** O ciclo dela é mantido por
 * automação fora do produto. Os gatilhos são os eventos do gateway e os eventos da SPA
 * sobre o **item** — exclusão e mudança de status —, e a diferença entre os dois níveis é
 * o que separa recurso de contrato: item cancelado é uma instância ou canal que ninguém
 * usa; assinatura manual cancelada é um contrato que outra automação administra.
 */

/**
 * Quem pediu a operação. Vira o motivo enviado ao provider, e é o que torna o
 * cancelamento rastreável do lado dele: três origens com o mesmo texto seriam três
 * investigações sem pista.
 */
export type ProviderBillingOrigin =
  | 'gateway-event'
  | 'spa-item-status'
  | 'spa-item-deleted'

/** O campo de motivo é texto livre no provider. */
const REASON_BY_ORIGIN: Record<ProviderBillingOrigin, string> = {
  'gateway-event': 'Assinatura cancelada no ThinkZap',
  'spa-item-status': 'Linha cancelada no ThinkZap',
  'spa-item-deleted': 'Linha removida no ThinkZap',
}

export type ProviderBillingOptions = {
  /** Ausente = `gateway-event`, o único chamador de antes destas opções existirem. */
  origin?: ProviderBillingOrigin
  /**
   * `true` faz a falha do provider **subir**. Existe para chamador que é job: lá o retry
   * é da fila, e engolir a falha deixaria o recurso cobrado de nós para sempre.
   *
   * Ausente mantém o comportamento do handler do gateway, que corre dentro de um webhook
   * e não pode propagar: o cancelamento na SPA já aconteceu, e o Bitrix desativa handler
   * que erra em sequência.
   */
  propagate?: boolean
}

/** A credencial de um recurso remoto, sem depender de o item ainda existir. */
export type ProviderResourceRef = {
  provider: 'ZAPI' | 'HUBMESSAGE'
  instanceId: string
  zApiToken?: string
  channelId?: string
}

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
   * **Não lança por padrão.** Chamada depois de as escritas na SPA concluírem: nesse
   * ponto o cliente pagou e a linha funciona, então falhar aqui é problema de operação
   * — nossa relação de cobrança com o provider — e não de produto. Propagar
   * trocaria um chamado interno por um cliente sem serviço. `propagate: true` inverte
   * isso, e existe para chamador que é job.
   */
  async subscribe(
    item: SubscriptionItem,
    options?: ProviderBillingOptions,
  ): Promise<void> {
    await this.runOnItem('subscribe', item, options)
  }

  /**
   * Desassina o recurso da linha no provider.
   *
   * **Não lança por padrão**, e a falha é registrada em `error` — não `warn`. Recurso
   * não desassinado é continuar pagando ao provider por cliente que saiu: perda direta
   * de dinheiro que ninguém abre chamado por, então o log é o único lugar onde
   * aparece.
   *
   * Falhar aqui **não** desfaz o cancelamento na SPA: a linha continua bloqueada.
   */
  async unsubscribe(
    item: SubscriptionItem,
    options?: ProviderBillingOptions,
  ): Promise<void> {
    await this.runOnItem('unsubscribe', item, options)
  }

  /**
   * As mesmas operações a partir da credencial **solta**, sem item.
   *
   * Existe para o caminho da exclusão: lá o item já não existe e a credencial vem do
   * espelho do recurso. Sem esta entrada, aquele caminho resolveria adapter e referência
   * por conta própria — e no dia em que um provider mudar de campo, duas resoluções
   * divergiriam, com uma delas cancelando o recurso errado.
   */
  async subscribeResource(
    ref: ProviderResourceRef,
    options?: ProviderBillingOptions,
  ): Promise<void> {
    await this.run('subscribe', ref, options)
  }

  async unsubscribeResource(
    ref: ProviderResourceRef,
    options?: ProviderBillingOptions,
  ): Promise<void> {
    await this.run('unsubscribe', ref, options)
  }

  private async runOnItem(
    operation: BillingOperation,
    item: SubscriptionItem,
    options?: ProviderBillingOptions,
  ): Promise<void> {
    const resolved = resolveFromItem(item)

    if ('skip' in resolved) {
      /**
       * Registrado, não silencioso: item sem credencial num fluxo de cobrança é
       * estado que alguém precisa ver — ou é linha nunca provisionada, ou é
       * credencial perdida.
       */
      logThinkzapError(
        apiLogger,
        'thinkzap.subscription.provider_billing_failed',
        {
          app: 'thinkzap',
          operation,
          subscriptionItemId: item.id,
          reason: resolved.skip,
        },
        {
          level: 'warn',
          msg: 'Operação de cobrança no provider não tentada: item sem credencial de provider',
        },
      )
      return
    }

    await this.run(operation, resolved, options, item.id)
  }

  private async run(
    operation: BillingOperation,
    resource: ProviderResourceRef,
    options?: ProviderBillingOptions,
    subscriptionItemId?: string,
  ): Promise<void> {
    const provider = providerOf(resource)
    /**
     * Só os campos que **aquele** provider usa. Mandar `channelId: null` para a Z-API
     * funcionaria, mas o `ConnectorResourceRef` é o contrato que os dois adapters leem, e
     * um campo nulo ali é indistinguível de "o canal desapareceu".
     */
    const ref: ConnectorResourceRef = {
      instanceId: resource.instanceId,
      ...(resource.zApiToken !== undefined && { zApiToken: resource.zApiToken }),
      ...(resource.channelId !== undefined && { channelId: resource.channelId }),
    }
    const reason = REASON_BY_ORIGIN[options?.origin ?? 'gateway-event']

    try {
      const adapter = this.providerResolver.resolve(provider)

      if (operation === 'subscribe') {
        await adapter.subscribe(ref)
      } else {
        await adapter.unsubscribe(ref, reason)
      }
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.subscription.provider_billing_failed',
        {
          app: 'thinkzap',
          operation,
          origin: options?.origin ?? 'gateway-event',
          subscriptionItemId,
          provider,
          resourceId: resource.instanceId,
          err: error,
        },
        {
          level: 'error',
          msg:
            operation === 'subscribe'
              ? 'Falha ao assinar o recurso no provider — a ativação segue válida e o recurso fica não assinado'
              : 'Falha ao desassinar o recurso no provider — continuamos sendo cobrados por cliente que saiu',
        },
      )

      // O log já saiu; propagar é sobre **quem retenta**, não sobre observabilidade.
      if (options?.propagate) throw error
    }
  }

}

/**
 * A credencial que **aquele** provider exige, extraída do `metadata` do item.
 *
 * Z-API opera por instância + token; HubMessage por canal. A extração vive aqui e não no
 * adapter porque é o formato do contrato neutro (`ConnectorResourceRef`) que muda de
 * significado entre os dois.
 *
 * Função módulo, e não método: o caminho da exclusão precisa da mesma tradução a partir
 * do espelho, e o backfill precisa dela a partir do item. Exportada por isso.
 */
export function resolveFromItem(
  item: SubscriptionItem,
): ProviderResourceRef | { skip: SkipReason } {
  const { metadata } = item

  if (metadata.provider === 'ZAPI') {
    return {
      provider: 'ZAPI',
      instanceId: metadata.zApiInstanceId,
      zApiToken: metadata.zApiInstanceToken,
    }
  }

  if (metadata.provider === 'HUBMESSAGE') {
    return {
      provider: 'HUBMESSAGE',
      instanceId: metadata.hubmessageChannelId,
      channelId: metadata.hubmessageChannelId,
    }
  }

  return { skip: 'no-provider-credential' }
}

/** O enum do resolver a partir do discriminante do espelho e do item. */
export const providerOf = (ref: ProviderResourceRef): ConnectorProvider =>
  ref.provider === 'HUBMESSAGE'
    ? ConnectorProvider.HUBMESSAGE
    : ConnectorProvider.ZAPI
