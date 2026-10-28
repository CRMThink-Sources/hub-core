import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { SpaItemResourceMirrorRepository } from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import {
  ConnectorResourceRef,
  SubscribeOutcome,
} from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
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
 * **A assinatura manual é assinada e desassinada pelos eventos da SPA.** O UPDATE do
 * item (1146) e o da assinatura (1142) assinam a linha ativa sob contrato ativo e não
 * trial que ainda não tenha a marca de assinado (`SyncSpaItemResourceStatus`). O UPDATE
 * da assinatura com status `cancelled` desassina todas as linhas dela
 * (`SyncSubscriptionLinesBilling`), de qualquer modalidade — na Stripe, quase sempre já
 * desassinadas pelo gateway, e então sem efeito. Pela SPA, o item também é desassinado
 * na exclusão e na mudança de status.
 *
 * **Toda operação bem-sucedida sobre um item grava a marca de cobrança no espelho**
 * (`subscribedAt`/`unsubscribedAt`). É o que impede os UPDATEs seguintes do item —
 * inclusive os gerados pelas escritas da própria API — de assinar de novo o que o
 * checkout ou a linha adicional acabaram de assinar.
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
  /** Status da assinatura (SPA 1142) mudado para cancelado no CRM. */
  | 'subscription-cancelled'
  | 'subscription-past-due'

/** O campo de motivo é texto livre no provider. */
const REASON_BY_ORIGIN: Record<ProviderBillingOrigin, string> = {
  'gateway-event': 'Assinatura cancelada no ThinkZap',
  'spa-item-status': 'Linha cancelada no ThinkZap',
  'spa-item-deleted': 'Linha removida no ThinkZap',
  'subscription-cancelled': 'Assinatura cancelada no CRM',
  'subscription-past-due': 'Assinatura vencida há 5 dias',
}

/**
 * Resultado da operação numa linha: `skipped` quando o item não tem credencial de
 * provider (nada foi tentado); `failed` quando o provider falhou sem `propagate`.
 */
export type ItemBillingResult = {
  status: 'unsubscribed' | 'subscribed' | 'skipped' | 'failed'
  provider: 'ZAPI' | 'HUBMESSAGE' | null
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
  constructor(
    private readonly providerResolver: ConnectorProviderResolver,
    /**
     * Opcional: sem ele as operações seguem iguais, só sem marca. Existe como opcional
     * para quem monta a cobrança sem Redis (scripts de operação).
     */
    private readonly mirrors?: SpaItemResourceMirrorRepository,
  ) {}

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
  ): Promise<ItemBillingResult> {
    return this.runOnItem('subscribe', item, options)
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
  ): Promise<ItemBillingResult> {
    return this.runOnItem('unsubscribe', item, options)
  }

  /**
   * As mesmas operações a partir da credencial **solta**, sem item.
   *
   * Existe para o caminho da exclusão: lá o item já não existe e a credencial vem do
   * espelho do recurso. Sem esta entrada, aquele caminho resolveria adapter e referência
   * por conta própria — e no dia em que um provider mudar de campo, duas resoluções
   * divergiriam, com uma delas cancelando o recurso errado.
   */
  /**
   * O que o provider respondeu, ou `null` quando falhou sem `propagate` (o log já
   * saiu). A reconciliação diária usa a diferença entre `subscribed` e
   * `already-subscribed`; os demais chamadores ignoram o retorno.
   */
  async subscribeResource(
    ref: ProviderResourceRef,
    options?: ProviderBillingOptions,
  ): Promise<SubscribeOutcome | null> {
    const result = await this.run('subscribe', ref, options)
    return result.ok ? (result.outcome ?? 'subscribed') : null
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
  ): Promise<ItemBillingResult> {
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
      return { status: 'skipped', provider: null }
    }

    const result = await this.run(operation, resolved, options, item.id)
    if (!result.ok) return { status: 'failed', provider: resolved.provider }

    await this.mark(item.id, operation)
    return {
      status: operation === 'subscribe' ? 'subscribed' : 'unsubscribed',
      provider: resolved.provider,
    }
  }

  /**
   * A marca é melhor esforço: a operação no provider já aconteceu, e falhar aqui custa no
   * máximo um subscribe repetido no próximo UPDATE do item. Propagar desfaria, para o
   * chamador, uma ativação que deu certo.
   */
  private async mark(
    itemId: string,
    operation: BillingOperation,
  ): Promise<void> {
    if (!this.mirrors) return

    try {
      await this.mirrors.setBillingState(
        itemId,
        operation === 'subscribe' ? 'subscribed' : 'unsubscribed',
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'thinkzap', subscriptionItemId: itemId, operation, err: error },
        'Operação no provider concluída, mas a marca de cobrança não foi gravada no espelho',
      )
    }
  }

  private async run(
    operation: BillingOperation,
    resource: ProviderResourceRef,
    options?: ProviderBillingOptions,
    subscriptionItemId?: string,
  ): Promise<{ ok: true; outcome?: SubscribeOutcome } | { ok: false }> {
    const provider = providerOf(resource)
    /**
     * Só os campos que **aquele** provider usa. Mandar `channelId: null` para a Z-API
     * funcionaria, mas o `ConnectorResourceRef` é o contrato que os dois adapters leem, e
     * um campo nulo ali é indistinguível de "o canal desapareceu".
     */
    const ref: ConnectorResourceRef = {
      instanceId: resource.instanceId,
      ...(resource.zApiToken !== undefined && {
        zApiToken: resource.zApiToken,
      }),
      ...(resource.channelId !== undefined && {
        channelId: resource.channelId,
      }),
    }
    const reason = REASON_BY_ORIGIN[options?.origin ?? 'gateway-event']

    try {
      const adapter = this.providerResolver.resolve(provider)

      if (operation === 'subscribe') {
        return { ok: true, outcome: await adapter.subscribe(ref) }
      }

      await adapter.unsubscribe(ref, reason)
      return { ok: true }
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
      return { ok: false }
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
