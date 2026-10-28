import {
  SaveSpaItemResourceMirrorInput,
  SpaItemResourceMirrorRepository,
} from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import { RawSubscriptionItemReader } from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'
import { apiLogger } from '@/shared/infra/logger'
import {
  ProviderBillingOrigin,
  ProviderResourceBilling,
  ProviderResourceRef,
} from './provider-resource-billing'
import { resolveRawItemResource } from './helpers/raw-item-resource'
import {
  resolveProviderBillingAction,
  type ProviderBillingMode,
  type ProviderUnsubscribeReason,
} from './helpers/resolve-provider-billing-action'
import type { SubscriptionStatusReader } from '@/modules/thinkzap/domain/ports/subscription-status-reader.port'

export type SyncSpaItemResourceStatusInput = {
  /** Id do item na SPA 1146. */
  itemId: string
  /** Correlação com a linha do webhook que originou o job. */
  traceKey: string
  /**
   * Status da assinatura pai já lido por quem chama — `null` quando ela não existe.
   *
   * Presente, ele vale sempre e o pai não é relido. É o caso do fan-out da assinatura
   * (`SyncSubscriptionLinesBilling`): a decisão de desassinar por pai cancelado depende
   * dele também para linha já assinada, que no UPDATE do item não lê o pai. Ausente,
   * vale a leitura preguiçosa de sempre.
   */
  parentStatus?: Subscription['status'] | null
  /**
   * Quem pede: o evento da SPA (padrão), a desassinatura do quinto dia de vencimento ou
   * a reconciliação diária. Ver `resolveProviderBillingAction`.
   */
  mode?: ProviderBillingMode
}

export type SyncSpaItemResourceStatusOutcome =
  /**
   * Item `cancelled`, ou assinatura pai `cancelled`, sem marca de desassinado: recurso
   * desassinado agora.
   */
  | 'unsubscribed'
  /**
   * Status `active` sob assinatura ativa e não trial, sem marca de assinado: recurso
   * assinado agora — a primeira assinatura de uma linha manual, ou a reassinatura.
   */
  | 'subscribed'
  /** Só na reconciliação: o provider disse que o recurso já estava pago. A marca é garantida. */
  | 'already-subscribed'
  /**
   * Status e marca já concordam — o caso de longe mais comum —, ou a assinatura pai não
   * permite assinar (trial, inativa, inexistente).
   */
  | 'noop'
  /** Item apagado entre o evento e a leitura: a exclusão tem caminho próprio. */
  | 'item-missing'
  /** Provider ausente, desconhecido, ou declarado sem credencial. */
  | 'no-credential'
  /** `ufCrm93Status` vazio ou com id de enum desconhecido. */
  | 'unknown-status'

export type SyncSpaItemResourceStatusResult = {
  outcome: SyncSpaItemResourceStatusOutcome
  /** Presente quando o provider foi chamado — o histórico da verificação registra qual. */
  provider?: ProviderResourceRef['provider']
}

/**
 * Reconcilia o **ciclo de cobrança** do recurso remoto com o status do item na SPA 1146.
 *
 * Existe porque `ufCrm93Status` é editável à mão no CRM, e é assim que o suporte encerra
 * uma linha sem esperar o gateway. Antes disto, marcar "Cancelado" bloqueava a linha no
 * app e não tocava o provider: seguíamos pagando pela instância ou pelo canal de uma
 * linha que ninguém usa.
 *
 * **A transição não vem do evento.** O payload do webhook traz só o id do item — nunca o
 * valor anterior do campo. A comparação é entre o status **lido no item** e as marcas de
 * cobrança no espelho do recurso, e é essa marca que
 * `provider-resource-billing-lifecycle` cita como o estado que faltava para haver
 * gatilho fora do gateway. A regra está em `resolveProviderBillingAction`.
 *
 * **Também assina.** Item ativo sob assinatura ativa e não trial, sem marca de assinado,
 * é assinado no provider — é o caminho da assinatura manual, que nenhum outro fluxo
 * assina. O mesmo caso de uso roda por item quando a assinatura (SPA 1142) é editada
 * (`SyncSubscriptionLinesBilling`).
 *
 * **E desassina por contrato cancelado.** Assinatura pai `cancelled` desassina a linha,
 * ativa ou não. O fan-out da assinatura passa o status do pai, e é por ele que linha já
 * assinada é desassinada — o UPDATE do item não relê o pai dessas linhas.
 *
 * **Só o eixo do dinheiro.** `unsubscribe` e `subscribe`, nunca `disconnect`: cancelar o
 * status é reversível — o item continua lá —, e desconectar custaria ao cliente uma
 * releitura de QR code por uma marcação que o suporte desfaz em um minuto. Bloquear a
 * linha na aplicação é papel do entitlement, que lê o status por conta própria.
 *
 * **Não reconcilia cobrança do contrato.** O item continua existindo e continua contando
 * como linha da assinatura; reduzir a quantidade por status editado à mão faria o cobrado
 * divergir da contagem de itens, que é a única fonte que o produto tem. Quem reduz é a
 * exclusão do item.
 *
 * A marca é gravada **depois** do sucesso da chamada, e a falha **propaga** para a fila
 * retentar: marcar sem desassinar esconderia para sempre um recurso que continua sendo
 * cobrado de nós, que é a falha que ninguém abre chamado por.
 */
const ORIGIN_BY_UNSUBSCRIBE_REASON: Record<
  ProviderUnsubscribeReason,
  ProviderBillingOrigin
> = {
  'parent-cancelled': 'subscription-cancelled',
  'parent-past-due-expired': 'subscription-past-due',
  'item-cancelled': 'spa-item-status',
}

const UNSUBSCRIBE_MESSAGE: Record<ProviderUnsubscribeReason, string> = {
  'parent-cancelled':
    'Assinatura cancelada na SPA — recurso desassinado no provider',
  'parent-past-due-expired':
    'Assinatura vencida há 5 dias — recurso desassinado no provider',
  'item-cancelled': 'Item cancelado na SPA — recurso desassinado no provider',
}

export class SyncSpaItemResourceStatus {
  constructor(
    private readonly items: RawSubscriptionItemReader,
    private readonly mirrors: SpaItemResourceMirrorRepository,
    private readonly billing: ProviderResourceBilling,
    private readonly subscriptions: SubscriptionStatusReader,
  ) {}

  async execute(
    input: SyncSpaItemResourceStatusInput,
  ): Promise<SyncSpaItemResourceStatusResult> {
    const log = {
      app: 'thinkzap' as const,
      itemId: input.itemId,
      traceKey: input.traceKey,
    }

    const item = await this.items.getRawSubscriptionItem(input.itemId)

    /**
     * Apagado entre o evento e a leitura. Sucesso sem efeito de propósito: a exclusão
     * tem caminho próprio, com o espelho como fonte, e agir aqui duplicaria a operação —
     * com os dois jobs correndo em paralelo sobre o mesmo recurso.
     */
    if (!item) {
      apiLogger.debug(
        log,
        'Item já não existe na SPA — a limpeza da exclusão é que trata este caso',
      )
      return { outcome: 'item-missing' }
    }

    if (item.status === null) {
      /**
       * `warn`: id de enum desconhecido é a SPA recriada ou migrada, e o mapa de status
       * do mapper ficou para trás. Não é caso de retentar — nada muda até alguém corrigir
       * o mapa.
       */
      apiLogger.warn(
        log,
        'Status do item não reconhecido — nenhuma operação de cobrança tentada',
      )
      return { outcome: 'unknown-status' }
    }

    const resource = resolveRawItemResource(item)
    if (!resource) {
      /**
       * Item sem credencial legível: provider vazio, `NONE`, ou declarado sem a credencial
       * daquele provider. Não há recurso a assinar nem a desassinar — ou é linha nunca
       * provisionada, ou é credencial perdida, e as duas são estado que alguém precisa ver.
       */
      apiLogger.warn(
        { ...log, provider: item.provider },
        'Item sem credencial de provider — nenhuma operação de cobrança tentada',
      )
      return { outcome: 'no-credential' }
    }

    const mirror = await this.mirrors.find(input.itemId)

    /**
     * Sem o status vindo de quem chama, o pai só é lido quando a decisão depende dele —
     * item ativo ainda não assinado. Este job roda a cada edição de campo do item, e a
     * imensa maioria termina em `noop` sem precisar de uma segunda ida ao Bitrix. Linha
     * assinada sob pai cancelado é desassinada pelo fan-out da assinatura, que passa o
     * status.
     */
    const needsParent =
      item.status === 'active' &&
      (mirror?.subscribedAt === undefined || input.mode === 'reconcile')
    const parentStatus =
      input.parentStatus !== undefined
        ? input.parentStatus
        : needsParent && item.subscriptionId
          ? await this.subscriptions.getSubscriptionStatus(item.subscriptionId)
          : null

    const decision = resolveProviderBillingAction({
      itemStatus: item.status,
      parentStatus,
      mirror,
      mode: input.mode,
    })

    if (decision.action === 'unsubscribe') {
      return this.unsubscribe({
        log,
        input,
        item,
        resource,
        reason: decision.reason,
      })
    }

    if (decision.action === 'subscribe') {
      return this.subscribe({ log, input, item, resource })
    }

    if (decision.reason === 'parent-missing') {
      /**
       * `warn`: item ativo com credencial e sem assinatura pai legível é linha
       * funcionando que ninguém cobra de nós — nem do cliente.
       */
      apiLogger.warn(
        { ...log, subscriptionId: item.subscriptionId },
        'Item ativo sem assinatura pai legível — recurso não assinado no provider',
      )
      return { outcome: 'noop' }
    }

    /**
     * `debug`, não `info`: este é o caminho de **toda** edição de campo do item — settings,
     * nome, canal vinculado, e as escritas da própria API. Em `info` ele afogaria o log.
     */
    apiLogger.debug(
      {
        ...log,
        status: item.status,
        parentStatus,
        reason: decision.reason,
      },
      'Nada a fazer no provider — estado de cobrança já concorda, ou a assinatura não permite assinar',
    )

    return { outcome: 'noop' }
  }

  private async unsubscribe(args: {
    log: Record<string, unknown>
    input: SyncSpaItemResourceStatusInput
    item: { subscriptionId: string | null }
    resource: ProviderResourceRef
    reason: ProviderUnsubscribeReason
  }): Promise<SyncSpaItemResourceStatusResult> {
    await this.billing.unsubscribeResource(args.resource, {
      origin: ORIGIN_BY_UNSUBSCRIBE_REASON[args.reason],
      propagate: true,
    })

    /**
     * O espelho é garantido **depois** de desassinar, e não antes: se ele não existia
     * (linha anterior ao backfill), gravá-lo aqui é o que torna a marca possível — e
     * gravá-lo antes deixaria um espelho sem marca caso a chamada ao provider falhasse,
     * que é indistinguível de recurso assinado.
     */
    await this.ensureMirror(
      args.input.itemId,
      args.resource,
      args.item.subscriptionId,
    )
    await this.mirrors.setBillingState(args.input.itemId, 'unsubscribed')

    apiLogger.info(
      {
        ...args.log,
        provider: args.resource.provider,
        resourceId: args.resource.instanceId,
        reason: args.reason,
      },
      UNSUBSCRIBE_MESSAGE[args.reason],
    )

    return { outcome: 'unsubscribed', provider: args.resource.provider }
  }

  /**
   * Mesma ordem do `unsubscribe`: chamada ao provider, espelho garantido, marca. A marca
   * só depois do sucesso — marcar sem assinar esconderia para sempre uma linha que o
   * provider trata como não paga.
   */
  private async subscribe(args: {
    log: Record<string, unknown>
    input: SyncSpaItemResourceStatusInput
    item: { subscriptionId: string | null }
    resource: ProviderResourceRef
  }): Promise<SyncSpaItemResourceStatusResult> {
    const outcome = await this.billing.subscribeResource(args.resource, {
      origin: 'spa-item-status',
      propagate: true,
    })

    await this.ensureMirror(
      args.input.itemId,
      args.resource,
      args.item.subscriptionId,
    )
    await this.mirrors.setBillingState(args.input.itemId, 'subscribed')

    apiLogger.info(
      {
        ...args.log,
        provider: args.resource.provider,
        resourceId: args.resource.instanceId,
      },
      outcome === 'already-subscribed'
        ? 'Recurso já estava assinado no provider — marca de assinado garantida'
        : 'Item ativo sob assinatura ativa — recurso assinado no provider',
    )

    return {
      outcome:
        outcome === 'already-subscribed' ? 'already-subscribed' : 'subscribed',
      provider: args.resource.provider,
    }
  }

  /**
   * Grava o espelho quando ele não existe, para que a marca tenha onde morar.
   *
   * Sem `subscriptionId` não há espelho possível — o valor exige o contrato pai, que é o
   * que o ajuste de cobrança da exclusão vai precisar. Item sem pai é estado inválido na
   * SPA, e aqui ele custa a idempotência: o próximo evento desassinaria de novo.
   */
  private async ensureMirror(
    itemId: string,
    resource: ProviderResourceRef,
    subscriptionId: string | null,
  ): Promise<void> {
    if (await this.mirrors.find(itemId)) return

    if (!subscriptionId) {
      apiLogger.warn(
        { app: 'thinkzap', itemId },
        'Item sem assinatura pai — espelho não gravado, e a desassinatura pode repetir no próximo evento',
      )
      return
    }

    const mirror: SaveSpaItemResourceMirrorInput = {
      provider: resource.provider,
      instanceId: resource.instanceId,
      ...(resource.zApiToken !== undefined && {
        zApiToken: resource.zApiToken,
      }),
      ...(resource.channelId !== undefined && {
        channelId: resource.channelId,
      }),
      subscriptionId,
    }

    await this.mirrors.save(itemId, mirror)
  }
}
