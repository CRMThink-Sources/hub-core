import type { SubscriptionItemIdLister } from '@/modules/thinkzap/domain/ports/subscription-item-id-lister.port'
import { apiLogger } from '@/shared/infra/logger'
import type {
  SyncSpaItemResourceStatus,
  SyncSpaItemResourceStatusOutcome,
} from './sync-spa-item-resource-status'

export type SyncSubscriptionLinesBillingInput = {
  /** Id da assinatura na SPA 1142. */
  subscriptionId: string
  traceKey: string
}

export type SyncSubscriptionLinesBillingResult = {
  items: number
  subscribed: number
  failed: number
}

/**
 * Reconcilia a cobrança no provider de **cada** linha de uma assinatura editada.
 *
 * Existe pela assinatura manual: ela é criada no CRM com os itens, e só depois o time
 * muda o status dela para "Ativo" — uma edição na SPA 1142, que não gera evento nenhum
 * nos itens. Sem isto, as linhas ficariam provisionadas e funcionando sem nunca serem
 * assinadas no provider, até alguém tocar em cada item.
 *
 * **Não reimplementa a regra.** Cada item passa por `SyncSpaItemResourceStatus`, o mesmo
 * caso de uso do UPDATE do item: a decisão de assinar, a marca e a idempotência ficam num
 * lugar só. O custo é reler a assinatura uma vez por item, que é pouco perto de duas
 * regras se dessincronizando.
 *
 * **Uma linha falhando não trava as outras.** As falhas são coletadas e o job lança no
 * fim, para a fila retentar. No retry, as linhas já assinadas têm a marca e terminam em
 * `noop` — só a que falhou chama o provider de novo.
 */
export class SyncSubscriptionLinesBilling {
  constructor(
    private readonly itemIds: SubscriptionItemIdLister,
    private readonly syncItem: Pick<SyncSpaItemResourceStatus, 'execute'>,
  ) {}

  async execute(
    input: SyncSubscriptionLinesBillingInput,
  ): Promise<SyncSubscriptionLinesBillingResult> {
    const log = {
      app: 'thinkzap' as const,
      subscriptionId: input.subscriptionId,
      traceKey: input.traceKey,
    }

    const ids = await this.itemIds.listSubscriptionItemIds(input.subscriptionId)

    const outcomes: SyncSpaItemResourceStatusOutcome[] = []
    const failures: Array<{ itemId: string; error: unknown }> = []

    for (const itemId of ids) {
      try {
        const result = await this.syncItem.execute({
          itemId,
          traceKey: input.traceKey,
        })
        outcomes.push(result.outcome)
      } catch (error) {
        failures.push({ itemId, error })
      }
    }

    const result: SyncSubscriptionLinesBillingResult = {
      items: ids.length,
      subscribed: outcomes.filter(outcome => outcome === 'subscribed').length,
      failed: failures.length,
    }

    if (failures.length > 0) {
      apiLogger.error(
        {
          ...log,
          ...result,
          failedItemIds: failures.map(failure => failure.itemId),
          err: failures[0]!.error,
        },
        'Cobrança de linhas da assinatura com falha em parte dos itens — o job será retentado',
      )
      throw new SubscriptionLinesBillingError(
        input.subscriptionId,
        failures.map(failure => failure.itemId),
      )
    }

    /**
     * `info` só quando algo foi assinado: o UPDATE da 1142 também é o caminho de toda
     * escrita do gateway na assinatura, e quase sempre termina sem efeito.
     */
    if (result.subscribed > 0) {
      apiLogger.info(
        { ...log, ...result },
        'Linhas da assinatura assinadas no provider',
      )
    } else {
      apiLogger.debug(
        { ...log, ...result },
        'Cobrança das linhas da assinatura já concorda — nada a fazer no provider',
      )
    }

    return result
  }
}

export class SubscriptionLinesBillingError extends Error {
  constructor(
    readonly subscriptionId: string,
    readonly failedItemIds: string[],
  ) {
    super(
      `Falha na cobrança de ${failedItemIds.length} linha(s) da assinatura ${subscriptionId}: ${failedItemIds.join(', ')}`,
    )
    this.name = 'SubscriptionLinesBillingError'
  }
}
