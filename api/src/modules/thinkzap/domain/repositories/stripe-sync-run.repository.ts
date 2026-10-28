import type {
  StripeSyncResult,
  StripeSyncRun,
  StripeSyncRunDetail,
  StripeSyncTrigger,
} from '../entities/stripe-sync-run'

export interface ListStripeSyncRunsInput {
  page: number
  limit: number
  trigger?: StripeSyncTrigger
  /** Só rodadas que alteraram, falharam por assinatura ou não terminaram bem. */
  onlyWithChanges?: boolean
}

/**
 * Histórico das rodadas da sincronização Stripe. Mesmo ciclo da verificação de
 * assinaturas: `start` → `finish` **ou** `fail`; `finish` grava contadores e changes
 * juntos.
 */
export interface StripeSyncRunRepository {
  start(input: {
    trigger: StripeSyncTrigger
    portalUserId?: string
  }): Promise<string>
  finish(id: string, result: StripeSyncResult, finishedAt: Date): Promise<void>
  fail(id: string, error: string, finishedAt: Date): Promise<void>
  list(
    input: ListStripeSyncRunsInput,
  ): Promise<{ runs: StripeSyncRun[]; total: number }>
  findById(id: string): Promise<StripeSyncRunDetail | null>
  /** Apaga as rodadas iniciadas antes de `date`; as changes vão em cascata. */
  deleteStartedBefore(date: Date): Promise<number>
}
