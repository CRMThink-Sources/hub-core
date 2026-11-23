import { insightsComputeQueue } from './insights-compute.queue'

/** Nome do job repetível do tick (na mesma fila dos cálculos). */
export const INSIGHTS_PREWARM_TICK_JOB = 'prewarm-tick'

/**
 * Intervalo do tick. O pré-aquecimento só recalcula o que está para sair da
 * janela servível (ver `processInsightsPrewarm`), então um intervalo curto não
 * multiplica a carga: só diminui a chance de um app ficar sem resultado entre
 * dois ticks.
 */
export const INSIGHTS_PREWARM_EVERY_MS = 10 * 60_000

/**
 * Garante o job repetível do tick. Idempotente: o BullMQ deduplica pelo nome +
 * opção de repeat, então pode ser chamado a cada boot do worker. O tick não tem
 * prioridade (roda antes de qualquer job com prioridade), e só agenda: o
 * trabalho pesado entra na fila com a prioridade baixa do pré-aquecimento.
 */
export async function ensureInsightsPrewarmTick(): Promise<void> {
  await insightsComputeQueue.add(
    INSIGHTS_PREWARM_TICK_JOB,
    { tick: true },
    {
      repeat: { every: INSIGHTS_PREWARM_EVERY_MS },
      removeOnComplete: true,
      removeOnFail: true,
    },
  )
}
