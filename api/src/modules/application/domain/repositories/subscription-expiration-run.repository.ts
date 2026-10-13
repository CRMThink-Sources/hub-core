import {
  SubscriptionExpirationResult,
  SubscriptionExpirationRun,
  SubscriptionExpirationRunDetail,
  SubscriptionExpirationTrigger,
} from '@/modules/application/domain/entities/subscription-expiration-run'

export interface ListSubscriptionExpirationRunsInput {
  page: number
  limit: number
  trigger?: SubscriptionExpirationTrigger
  /** Só rodadas que alteraram, falharam por assinatura ou não terminaram bem. */
  onlyWithChanges?: boolean
}

/**
 * Histórico das rodadas da varredura de expiração.
 *
 * O ciclo de uma rodada é `start` → `finish` **ou** `fail`. `finish` grava
 * contadores e changes juntos: uma rodada `success` sem as changes dela mentiria
 * na tela.
 */
export interface SubscriptionExpirationRunRepository {
  start(input: {
    trigger: SubscriptionExpirationTrigger
    portalUserId?: string
  }): Promise<string>
  finish(
    id: string,
    result: SubscriptionExpirationResult,
    finishedAt: Date,
  ): Promise<void>
  fail(id: string, error: string, finishedAt: Date): Promise<void>
  list(
    input: ListSubscriptionExpirationRunsInput,
  ): Promise<{ runs: SubscriptionExpirationRun[]; total: number }>
  findById(id: string): Promise<SubscriptionExpirationRunDetail | null>
  /** Apaga as rodadas iniciadas antes de `date`; as changes vão em cascata. */
  deleteStartedBefore(date: Date): Promise<number>
}
