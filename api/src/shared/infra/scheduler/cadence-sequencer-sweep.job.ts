import cron from 'node-cron'
import { SweepCadenceSequencer } from '@/modules/thinkzap/application/sweep-cadence-sequencer'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { makeSendCadence } from '@/modules/thinkzap/main/make-send-cadence'
import { apiLogger } from '@/shared/infra/logger'

/** A cada minuto: no pior caso, uma cabeça órfã atrasa a linha ~2 min (duas rodadas). */
const SCHEDULE = '* * * * *'

export type CadenceSequencerSweepJobDeps = {
  schedule: (expression: string, task: () => Promise<void>) => void
  makeSweep: () => Pick<SweepCadenceSequencer, 'run'>
}

const defaultDeps = (): CadenceSequencerSweepJobDeps => ({
  schedule: (expression, task) => {
    cron.schedule(expression, task)
  },
  makeSweep: () =>
    new SweepCadenceSequencer(
      makeSendCadence(),
      new PrismaWidgetOutboxRepository(),
    ),
})

/** Agenda a varredura do sequenciador FIFO da cadência (ver `SweepCadenceSequencer`). */
export function startCadenceSequencerSweepJob(
  overrides: Partial<CadenceSequencerSweepJobDeps> = {},
): void {
  const deps = { ...defaultDeps(), ...overrides }
  // Uma instância por processo: a memória das duas rodadas mora nela.
  const sweep = deps.makeSweep()

  deps.schedule(SCHEDULE, async () => {
    try {
      await sweep.run()
    } catch (error) {
      apiLogger.error(
        { app: 'thinkzap', err: error },
        '[CadenceSequencerSweepJob] Falha na varredura',
      )
    }
  })
}
