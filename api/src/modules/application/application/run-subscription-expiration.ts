import {
  SubscriptionExpirationResult,
  SubscriptionExpirationTrigger,
} from '@/modules/application/domain/entities/subscription-expiration-run'
import { SubscriptionExpirationRunRepository } from '@/modules/application/domain/repositories/subscription-expiration-run.repository'
import { apiLogger } from '@/shared/infra/logger'

export type StartRunInput = {
  trigger: SubscriptionExpirationTrigger
  portalUserId?: string
}

/**
 * Uma rodada da varredura **com histórico**: registra o início, roda
 * `ExpireSubscriptions` e grava o resultado.
 *
 * O histórico é secundário à varredura. Falha ao gravá-lo vai para o log e não
 * desfaz nem impede o que já foi gravado no Bitrix — a SPA é a fonte de verdade, a
 * tabela só conta o que aconteceu.
 *
 * `begin` e `complete` são separados porque o disparo manual precisa do id da
 * rodada para responder antes de a varredura terminar.
 */
export class RunSubscriptionExpiration {
  constructor(
    private readonly expire: {
      execute(now?: Date): Promise<SubscriptionExpirationResult>
    },
    private readonly runs: SubscriptionExpirationRunRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Registra a rodada como `running`. Lança se não conseguir. */
  begin(input: StartRunInput): Promise<string> {
    return this.runs.start(input)
  }

  /**
   * Roda a varredura e fecha o registro. `runId` nulo roda sem registrar — é o
   * caso em que o `begin` falhou, e a varredura não pode depender da tabela.
   * Erro da varredura sobe depois de registrado.
   */
  async complete(runId: string | null): Promise<SubscriptionExpirationResult> {
    let result: SubscriptionExpirationResult

    try {
      result = await this.expire.execute(this.clock())
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

  /** `begin` + `complete`, para quem não precisa do id antes (o cron). */
  async run(input: StartRunInput): Promise<SubscriptionExpirationResult> {
    let runId: string | null = null

    try {
      runId = await this.begin(input)
    } catch (error) {
      apiLogger.error(
        { app: 'shared', err: error, trigger: input.trigger },
        'Falha ao registrar início da rodada de expiração — rodando sem histórico',
      )
    }

    return this.complete(runId)
  }

  private async record(runId: string, write: () => Promise<void>) {
    try {
      await write()
    } catch (error) {
      apiLogger.error(
        { app: 'shared', err: error, runId },
        'Falha ao gravar resultado da rodada de expiração no histórico',
      )
    }
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
