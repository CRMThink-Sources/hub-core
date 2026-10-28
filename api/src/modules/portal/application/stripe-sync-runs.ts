import type {
  StripeSyncChange,
  StripeSyncRun,
} from '@/modules/thinkzap/domain/entities/stripe-sync-run'
import type {
  ListStripeSyncRunsInput,
  StripeSyncRunRepository,
} from '@/modules/thinkzap/domain/repositories/stripe-sync-run.repository'
import { ABANDONED_AFTER_MS } from './subscription-expiration-runs'

export type StripeSyncRunView = StripeSyncRun & {
  abandoned: boolean
  durationMs: number | null
}

export type StripeSyncChangeView = StripeSyncChange & {
  /** Link da assinatura na SPA 1142; `null` sem portal configurado. */
  crmUrl: string | null
  /** Nas linhas: link do item na SPA 1146. */
  itemCrmUrl: string | null
}

/** Mesmo corte de "abandonada" da verificação: o lock dura 55 min. */
const toRunView = (run: StripeSyncRun, now: Date): StripeSyncRunView => ({
  ...run,
  abandoned:
    run.status === 'running' &&
    now.getTime() - run.startedAt.getTime() > ABANDONED_AFTER_MS,
  durationMs: run.finishedAt
    ? run.finishedAt.getTime() - run.startedAt.getTime()
    : null,
})

export class ListStripeSyncRuns {
  constructor(
    private readonly runs: Pick<StripeSyncRunRepository, 'list'>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: ListStripeSyncRunsInput) {
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

export class GetStripeSyncRun {
  constructor(
    private readonly runs: Pick<StripeSyncRunRepository, 'findById'>,
    private readonly crmOrigin: string | null,
    private readonly subscriptionEntityTypeId: number,
    private readonly subscriptionItemEntityTypeId: number,
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
        (change): StripeSyncChangeView => ({
          ...change,
          crmUrl: this.crmOrigin
            ? `${this.crmOrigin}/crm/type/${this.subscriptionEntityTypeId}/details/${change.subscriptionId}/`
            : null,
          itemCrmUrl:
            this.crmOrigin && change.itemId
              ? `${this.crmOrigin}/crm/type/${this.subscriptionItemEntityTypeId}/details/${change.itemId}/`
              : null,
        }),
      ),
    }
  }
}
