import type {
  StripeSyncResult,
  StripeSyncTrigger,
} from '@/modules/thinkzap/domain/entities/stripe-sync-run'
import type { StripeSyncRunRepository } from '@/modules/thinkzap/domain/repositories/stripe-sync-run.repository'
import { apiLogger } from '@/shared/infra/logger'

export type StartStripeSyncInput = {
  trigger: StripeSyncTrigger
  portalUserId?: string
}

/**
 * Uma rodada da sincronização Stripe **com histórico**, no mesmo molde da
 * verificação de assinaturas: o histórico é secundário — falha ao gravá-lo vai para
 * o log e não desfaz o que já foi escrito na SPA.
 */
export class RunStripeSync {
  constructor(
    private readonly sync: { execute(): Promise<StripeSyncResult> },
    private readonly runs: StripeSyncRunRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Registra a rodada como `running`. Lança se não conseguir. */
  begin(input: StartStripeSyncInput): Promise<string> {
    return this.runs.start(input)
  }

  /** Roda e fecha o registro; `runId` nulo roda sem registrar. Erro sobe depois de registrado. */
  async complete(runId: string | null): Promise<StripeSyncResult> {
    let result: StripeSyncResult

    try {
      result = await this.sync.execute()
    } catch (error) {
      if (runId) {
        await this.record(runId, () =>
          this.runs.fail(runId, messageOf(error), this.clock()),
        )
      }
      throw error
    }

    if (runId) {
      await this.record(runId, () =>
        this.runs.finish(runId, result, this.clock()),
      )
    }

    return result
  }

  /** `begin` + `complete`, para o cron. */
  async run(input: StartStripeSyncInput): Promise<StripeSyncResult> {
    let runId: string | null = null

    try {
      runId = await this.begin(input)
    } catch (error) {
      apiLogger.error(
        { app: 'thinkzap', err: error, trigger: input.trigger },
        'Falha ao registrar início da sincronização Stripe — rodando sem histórico',
      )
    }

    return this.complete(runId)
  }

  private async record(runId: string, write: () => Promise<void>) {
    try {
      await write()
    } catch (error) {
      apiLogger.error(
        { app: 'thinkzap', err: error, runId },
        'Falha ao gravar resultado da sincronização Stripe no histórico',
      )
    }
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
