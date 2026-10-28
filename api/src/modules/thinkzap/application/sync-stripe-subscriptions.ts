import type { StripeEnvironment } from '@/config/env'
import type {
  StripeSyncChange,
  StripeSyncResult,
} from '@/modules/thinkzap/domain/entities/stripe-sync-run'
import type { GatewaySubscriptionStateReader } from '@/modules/thinkzap/domain/ports/gateway-subscription-state-reader.port'
import type {
  StripeSubscriptionLister,
  StripeSubscriptionRef,
} from '@/modules/thinkzap/domain/ports/stripe-subscription-lister.port'
import { BitrixMethodPausedError } from '@/shared/infra/bitrix-limits/bitrix-limits.port'
import { apiLogger } from '@/shared/infra/logger'
import type {
  ApplyGatewaySubscriptionState,
  GatewayStateResult,
} from './apply-gateway-subscription-state'

/** Origem nos logs de `ApplyGatewaySubscriptionState`, no lugar do nome do evento. */
const SOURCE = 'stripe-sync'

/**
 * Reconcilia as assinaturas Stripe da SPA 1142 com o Stripe: o que o webhook teria
 * aplicado e não aplicou (evento perdido, API fora do ar, edição à mão no CRM).
 *
 * Só as assinaturas do ambiente da chave em uso — o portal é compartilhado com
 * homologação, e uma assinatura de teste lida com a chave live seria "não encontrada".
 * Ambiente vazio conta como produção.
 *
 * Um id do gateway por vez (várias assinaturas da SPA podem compartilhar o mesmo
 * contrato), cada um com o seu `try/catch`: a falha em um não segura os outros. A
 * pausa do Bitrix vale para o portal inteiro e encerra a rodada.
 */
export class SyncStripeSubscriptions {
  constructor(
    private readonly lister: StripeSubscriptionLister,
    private readonly gateway: GatewaySubscriptionStateReader,
    private readonly applyState: Pick<
      ApplyGatewaySubscriptionState,
      'applyUpdate' | 'applyCancellation'
    >,
    private readonly environment: StripeEnvironment,
  ) {}

  async execute(): Promise<StripeSyncResult> {
    const summary: StripeSyncResult = {
      checked: 0,
      skipped: 0,
      updated: 0,
      cancelled: 0,
      linesUnsubscribed: 0,
      notFound: 0,
      failed: 0,
      paused: false,
      changes: [],
    }

    try {
      const byGatewayId = this.select(
        await this.lister.listStripeSubscriptions(),
        summary,
      )

      for (const [gatewayId, refs] of byGatewayId) {
        summary.checked++
        await this.syncOne(gatewayId, refs, summary)
      }
    } catch (error) {
      if (!(error instanceof BitrixMethodPausedError)) throw error

      summary.paused = true
      apiLogger.warn(
        { app: 'thinkzap', err: error },
        'Bitrix pausou o método — sincronização Stripe encerrada até a próxima rodada',
      )
    }

    const { changes: _changes, ...counters } = summary
    apiLogger.info(
      { app: 'thinkzap', ...counters },
      'Sincronização Stripe concluída',
    )

    return summary
  }

  /** Agrupa por id do gateway as do ambiente certo; as outras só contam como puladas. */
  private select(
    refs: StripeSubscriptionRef[],
    summary: StripeSyncResult,
  ): Map<string, StripeSubscriptionRef[]> {
    const groups = new Map<string, StripeSubscriptionRef[]>()

    for (const ref of refs) {
      const environment = ref.environment ?? 'production'
      if (!ref.gatewayId || environment !== this.environment) {
        summary.skipped++
        continue
      }
      groups.set(ref.gatewayId, [...(groups.get(ref.gatewayId) ?? []), ref])
    }

    return groups
  }

  private async syncOne(
    gatewayId: string,
    refs: StripeSubscriptionRef[],
    summary: StripeSyncResult,
  ): Promise<void> {
    try {
      const state = await this.gateway.readSubscriptionState(gatewayId)

      if (state.kind === 'not-found') {
        for (const ref of refs) {
          summary.notFound++
          summary.changes.push(
            this.untouched(ref, gatewayId, 'not-found', {
              error: 'Assinatura não encontrada no Stripe',
            }),
          )
        }
        return
      }

      if (state.status === null) {
        for (const ref of refs) {
          summary.failed++
          summary.changes.push(
            this.untouched(ref, gatewayId, 'unknown-status', {
              toStatus: state.rawStatus,
              error: `Status do Stripe fora do mapa: ${state.rawStatus}`,
            }),
          )
        }
        return
      }

      const result =
        state.status === 'cancelled'
          ? await this.applyState.applyCancellation(gatewayId, SOURCE)
          : await this.applyState.applyUpdate(
              gatewayId,
              {
                status: state.status,
                currentPeriodStart: state.currentPeriodStart,
                currentPeriodEnd: state.currentPeriodEnd,
              },
              state.totalLineQuantity,
              SOURCE,
            )

      this.record(gatewayId, result, summary)
    } catch (error) {
      if (error instanceof BitrixMethodPausedError) throw error

      apiLogger.error(
        { app: 'thinkzap', gatewayId, err: error },
        'Falha ao sincronizar assinatura com o Stripe — nova tentativa na próxima rodada',
      )
      for (const ref of refs) {
        summary.failed++
        summary.changes.push(
          this.untouched(ref, gatewayId, 'failed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        )
      }
    }
  }

  private record(
    gatewayId: string,
    result: GatewayStateResult,
    summary: StripeSyncResult,
  ): void {
    for (const item of result.subscriptions) {
      if (item.outcome === 'unchanged') continue

      const base = {
        subscriptionId: item.subscriptionId,
        gatewayId,
        fromStatus: item.from.status,
        toStatus: item.to?.status ?? null,
        fromPeriodEnd: item.from.currentPeriodEnd,
        toPeriodEnd: item.to?.currentPeriodEnd ?? null,
      }

      if (item.outcome === 'failed') {
        summary.failed++
        summary.changes.push({
          ...base,
          kind: 'failed',
          succeeded: false,
          ...(item.error && { error: item.error }),
        })
        continue
      }

      if (item.outcome === 'updated') {
        summary.updated++
        summary.changes.push({ ...base, kind: 'updated', succeeded: true })
        continue
      }

      summary.cancelled++
      summary.changes.push({ ...base, kind: 'cancelled', succeeded: true })

      for (const line of item.lines ?? []) {
        if (line.succeeded) summary.linesUnsubscribed++
        else summary.failed++
        summary.changes.push({
          kind: 'line-unsubscribed',
          subscriptionId: item.subscriptionId,
          gatewayId,
          itemId: line.itemId,
          ...(line.provider && { provider: line.provider }),
          fromStatus: null,
          toStatus: null,
          fromPeriodEnd: null,
          toPeriodEnd: null,
          succeeded: line.succeeded,
          ...(!line.succeeded && {
            error: 'Falha ao desassinar a linha no provider',
          }),
        })
      }
    }
  }

  /** Registro de uma assinatura que a rodada não tocou na SPA. */
  private untouched(
    ref: StripeSubscriptionRef,
    gatewayId: string,
    kind: 'not-found' | 'unknown-status' | 'failed',
    extra: { toStatus?: string; error: string },
  ): StripeSyncChange {
    return {
      kind,
      subscriptionId: ref.id,
      gatewayId,
      fromStatus: null,
      toStatus: extra.toStatus ?? null,
      fromPeriodEnd: null,
      toPeriodEnd: null,
      succeeded: false,
      error: extra.error,
    }
  }
}
