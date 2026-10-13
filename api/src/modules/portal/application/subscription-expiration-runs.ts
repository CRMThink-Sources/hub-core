import {
  SubscriptionExpirationChange,
  SubscriptionExpirationRun,
} from '@/modules/application/domain/entities/subscription-expiration-run'
import {
  ListSubscriptionExpirationRunsInput,
  SubscriptionExpirationRunRepository,
} from '@/modules/application/domain/repositories/subscription-expiration-run.repository'

/**
 * Depois disto uma rodada `running` é tida como abandonada: o lock dura 55 min,
 * então nenhuma rodada viva passa de 1h — quem passou morreu sem gravar o fim.
 */
export const ABANDONED_AFTER_MS = 60 * 60 * 1000

export type SubscriptionExpirationRunView = SubscriptionExpirationRun & {
  abandoned: boolean
  /** `null` enquanto não terminou. */
  durationMs: number | null
}

export type SubscriptionExpirationChangeView = SubscriptionExpirationChange & {
  /** Link do item na SPA 1142 do CRM interno; `null` sem portal configurado. */
  crmUrl: string | null
}

export const toRunView = (
  run: SubscriptionExpirationRun,
  now: Date,
): SubscriptionExpirationRunView => ({
  ...run,
  abandoned:
    run.status === 'running' &&
    now.getTime() - run.startedAt.getTime() > ABANDONED_AFTER_MS,
  durationMs: run.finishedAt
    ? run.finishedAt.getTime() - run.startedAt.getTime()
    : null,
})

/**
 * Só a **origem** do webhook: o caminho dele carrega o segredo de acesso ao CRM, e
 * este valor vai para o navegador.
 */
export function crmOriginFromWebhook(webhookUrl: string): string | null {
  if (!webhookUrl) return null
  try {
    return new URL(webhookUrl).origin
  } catch {
    return null
  }
}

export class ListSubscriptionExpirationRuns {
  constructor(
    private readonly runs: Pick<SubscriptionExpirationRunRepository, 'list'>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: ListSubscriptionExpirationRunsInput) {
    const { runs, total } = await this.runs.list(input)
    const now = this.clock()

    return {
      runs: runs.map(run => toRunView(run, now)),
      meta: {
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      },
    }
  }
}

export class GetSubscriptionExpirationRun {
  constructor(
    private readonly runs: Pick<
      SubscriptionExpirationRunRepository,
      'findById'
    >,
    private readonly crmOrigin: string | null,
    private readonly subscriptionEntityTypeId: number,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** `null` para rodada desconhecida — o controller responde `404`. */
  async execute(id: string) {
    const run = await this.runs.findById(id)
    if (!run) return null

    const { changes, ...rest } = run

    return {
      ...toRunView(rest, this.clock()),
      changes: changes.map(
        (change): SubscriptionExpirationChangeView => ({
          ...change,
          crmUrl: this.crmOrigin
            ? `${this.crmOrigin}/crm/type/${this.subscriptionEntityTypeId}/details/${change.subscriptionId}/`
            : null,
        }),
      ),
    }
  }
}
