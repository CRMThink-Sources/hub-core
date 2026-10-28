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

export type CompleteRunOptions = {
  /** Inclui a reconciliação das linhas. O manual sempre inclui; o agendado, pela janela. */
  reconcile?: boolean
}

/** Janela diária da reconciliação: a primeira rodada agendada a partir de `hour` no fuso. */
export type ReconciliationWindow = {
  hour: number
  timeZone: string
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
      execute(
        now?: Date,
        options?: CompleteRunOptions,
      ): Promise<SubscriptionExpirationResult>
    },
    private readonly runs: SubscriptionExpirationRunRepository,
    private readonly clock: () => Date = () => new Date(),
    private readonly window: ReconciliationWindow = {
      hour: 3,
      timeZone: 'America/Sao_Paulo',
    },
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
  async complete(
    runId: string | null,
    options: CompleteRunOptions = {},
  ): Promise<SubscriptionExpirationResult> {
    let result: SubscriptionExpirationResult

    try {
      result = await this.expire.execute(this.clock(), options)
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

  /**
   * A rodada agendada reconcilia se já passou da hora da janela no fuso e nenhuma
   * rodada reconciliou desde a meia-noite local. Assim a das 03:00 que caiu é coberta
   * pela das 04:00. Na dúvida (histórico ilegível), não reconcilia — a próxima tenta.
   */
  async shouldReconcile(): Promise<boolean> {
    const now = this.clock()
    const { hour, msSinceMidnight } = localTimeOfDay(now, this.window.timeZone)
    if (hour < this.window.hour) return false

    try {
      const startOfLocalDay = new Date(now.getTime() - msSinceMidnight)
      return !(await this.runs.hasReconciliationSince(startOfLocalDay))
    } catch (error) {
      apiLogger.warn(
        { app: 'shared', err: error },
        'Falha ao consultar a última reconciliação — rodada segue sem reconciliar',
      )
      return false
    }
  }

  /** `begin` + `complete`, para quem não precisa do id antes (o cron). */
  async run(input: StartRunInput): Promise<SubscriptionExpirationResult> {
    const reconcile =
      input.trigger === 'manual' ? true : await this.shouldReconcile()
    let runId: string | null = null

    try {
      runId = await this.begin(input)
    } catch (error) {
      apiLogger.error(
        { app: 'shared', err: error, trigger: input.trigger },
        'Falha ao registrar início da rodada de expiração — rodando sem histórico',
      )
    }

    return this.complete(runId, { reconcile })
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

/** Hora e tempo desde a meia-noite em `timeZone`, sem depender do fuso do servidor. */
export function localTimeOfDay(
  now: Date,
  timeZone: string,
): { hour: number; msSinceMidnight: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(part => [part.type, part.value]),
  )
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const second = Number(parts.second)
  return {
    hour,
    msSinceMidnight:
      ((hour * 60 + minute) * 60 + second) * 1000 + now.getMilliseconds(),
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
