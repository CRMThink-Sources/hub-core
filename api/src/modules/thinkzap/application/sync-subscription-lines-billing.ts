import type { SubscriptionItemIdLister } from '@/modules/thinkzap/domain/ports/subscription-item-id-lister.port'
import type { SubscriptionStatusReader } from '@/modules/thinkzap/domain/ports/subscription-status-reader.port'
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
  unsubscribed: number
  failed: number
}

/**
 * Reconcilia a cobrança no provider de **cada** linha de uma assinatura editada, nos
 * dois sentidos.
 *
 * Existe pela assinatura manual, cujo status é mudado à mão no CRM — uma edição na SPA
 * 1142, que não gera evento nenhum nos itens:
 *
 * - **"Ativo"**: ela é criada com os itens e só depois ativada. Sem isto, as linhas
 *   ficariam provisionadas e funcionando sem nunca serem assinadas no provider.
 * - **"Cancelado"**: sem isto, seguiríamos pagando ao provider pelas linhas de quem saiu.
 *   Vale também para a Stripe, onde o gateway já desassinou e marcou, e então é `noop`.
 *
 * **Não reimplementa a regra.** Cada item passa por `SyncSpaItemResourceStatus`, o mesmo
 * caso de uso do UPDATE do item: a decisão, a marca e a idempotência ficam num lugar só.
 * O status da assinatura é lido **uma vez** aqui e repassado a cada item — é ele que faz
 * a linha já assinada ser desassinada, porque o UPDATE do item não relê o pai dela.
 *
 * **Uma linha falhando não trava as outras.** As falhas são coletadas e o job lança no
 * fim, para a fila retentar. No retry, as linhas já reconciliadas têm a marca e terminam
 * em `noop` — só a que falhou chama o provider de novo.
 */
export class SyncSubscriptionLinesBilling {
  constructor(
    private readonly itemIds: SubscriptionItemIdLister,
    private readonly syncItem: Pick<SyncSpaItemResourceStatus, 'execute'>,
    private readonly subscriptions: SubscriptionStatusReader,
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

    /** `null` (assinatura sumiu) é repassado: cada item cai em `parent-missing`. */
    const parentStatus =
      ids.length > 0
        ? await this.subscriptions.getSubscriptionStatus(input.subscriptionId)
        : null

    const outcomes: SyncSpaItemResourceStatusOutcome[] = []
    const failures: Array<{ itemId: string; error: unknown }> = []

    for (const itemId of ids) {
      try {
        const result = await this.syncItem.execute({
          itemId,
          traceKey: input.traceKey,
          parentStatus,
        })
        outcomes.push(result.outcome)
      } catch (error) {
        failures.push({ itemId, error })
      }
    }

    const result: SyncSubscriptionLinesBillingResult = {
      items: ids.length,
      subscribed: outcomes.filter(outcome => outcome === 'subscribed').length,
      unsubscribed: outcomes.filter(outcome => outcome === 'unsubscribed')
        .length,
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
        result,
      )
    }

    /**
     * `info` só quando algo mudou no provider: o UPDATE da 1142 também é o caminho de
     * toda escrita do gateway na assinatura, e quase sempre termina sem efeito.
     */
    if (result.subscribed + result.unsubscribed > 0) {
      apiLogger.info(
        { ...log, ...result, parentStatus },
        'Cobrança das linhas da assinatura reconciliada no provider',
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
    /**
     * As contagens da rodada, inclusive das linhas que deram certo. A fila só precisa
     * saber que falhou; o "Assinar todas" do backoffice mostra quantas foram.
     */
    readonly result?: SyncSubscriptionLinesBillingResult,
  ) {
    super(
      `Falha na cobrança de ${failedItemIds.length} linha(s) da assinatura ${subscriptionId}: ${failedItemIds.join(', ')}`,
    )
    this.name = 'SubscriptionLinesBillingError'
  }
}
