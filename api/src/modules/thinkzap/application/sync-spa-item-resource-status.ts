import {
  SaveSpaItemResourceMirrorInput,
  SpaItemResourceMirrorRepository,
} from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { RawSubscriptionItemReader } from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'
import { apiLogger } from '@/shared/infra/logger'
import {
  ProviderResourceBilling,
  ProviderResourceRef,
} from './provider-resource-billing'
import { resolveRawItemResource } from './helpers/raw-item-resource'

export type SyncSpaItemResourceStatusInput = {
  /** Id do item na SPA 1146. */
  itemId: string
  /** Correlação com a linha do webhook que originou o job. */
  traceKey: string
}

export type SyncSpaItemResourceStatusOutcome =
  /** Status `cancelled` sem marca: recurso desassinado agora. */
  | 'unsubscribed'
  /** Status `active` com marca: recurso reassinado agora. */
  | 'resubscribed'
  /** Status e marca já concordam — o caso de longe mais comum. */
  | 'noop'
  /** Item apagado entre o evento e a leitura: a exclusão tem caminho próprio. */
  | 'item-missing'
  /** Provider ausente, desconhecido, ou declarado sem credencial. */
  | 'no-credential'
  /** `ufCrm93Status` vazio ou com id de enum desconhecido. */
  | 'unknown-status'

export type SyncSpaItemResourceStatusResult = {
  outcome: SyncSpaItemResourceStatusOutcome
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
 * valor anterior do campo. A comparação é entre o status **lido no item** e a marca de
 * desassinado no espelho do recurso, e é essa marca que
 * `provider-resource-billing-lifecycle` cita como o estado que faltava para haver
 * gatilho fora do gateway.
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
export class SyncSpaItemResourceStatus {
  constructor(
    private readonly items: RawSubscriptionItemReader,
    private readonly mirrors: SpaItemResourceMirrorRepository,
    private readonly billing: ProviderResourceBilling,
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
    const alreadyUnsubscribed = mirror?.unsubscribedAt !== undefined

    if (item.status === 'cancelled' && !alreadyUnsubscribed) {
      return this.unsubscribe({ log, input, item, resource })
    }

    if (item.status === 'active' && alreadyUnsubscribed) {
      return this.resubscribe({ log, input, resource })
    }

    /**
     * `debug`, não `info`: este é o caminho de **toda** edição de campo do item — settings,
     * nome, canal vinculado, e as escritas da própria API. Em `info` ele afogaria o log.
     */
    apiLogger.debug(
      { ...log, status: item.status, alreadyUnsubscribed },
      'Status do item e estado de cobrança já concordam — nada a fazer no provider',
    )

    return { outcome: 'noop' }
  }

  private async unsubscribe(args: {
    log: Record<string, unknown>
    input: SyncSpaItemResourceStatusInput
    item: { subscriptionId: string | null }
    resource: ProviderResourceRef
  }): Promise<SyncSpaItemResourceStatusResult> {
    await this.billing.unsubscribeResource(args.resource, {
      origin: 'spa-item-status',
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
    await this.mirrors.setUnsubscribed(args.input.itemId, true)

    apiLogger.info(
      {
        ...args.log,
        provider: args.resource.provider,
        resourceId: args.resource.instanceId,
      },
      'Item cancelado na SPA — recurso desassinado no provider',
    )

    return { outcome: 'unsubscribed' }
  }

  private async resubscribe(args: {
    log: Record<string, unknown>
    input: SyncSpaItemResourceStatusInput
    resource: ProviderResourceRef
  }): Promise<SyncSpaItemResourceStatusResult> {
    await this.billing.subscribeResource(args.resource, {
      origin: 'spa-item-status',
      propagate: true,
    })

    await this.mirrors.setUnsubscribed(args.input.itemId, false)

    apiLogger.info(
      {
        ...args.log,
        provider: args.resource.provider,
        resourceId: args.resource.instanceId,
      },
      'Item devolvido a ativo na SPA — recurso reassinado no provider',
    )

    return { outcome: 'resubscribed' }
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
