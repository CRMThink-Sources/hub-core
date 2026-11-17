const DAY_SECONDS = 24 * 60 * 60

/**
 * Opções dos jobs disparados pelos eventos das SPAs de billing.
 *
 * O colapso de rajada é por `deduplication`, não por `jobId` fixo. Com `jobId` fixo o
 * job concluído fica retido com o mesmo id, e todo evento posterior do item era
 * descartado como duplicado — o cancelamento de uma linha nunca chegava ao provider.
 *
 * `keepLastIfActive`: evento que chega com o job do mesmo item rodando é guardado e
 * roda depois dele. Sem isso, a mudança feita depois de o job ler o item se perdia.
 * Também impede dois jobs do mesmo item em paralelo.
 */
export function spaEffectJobOptions(deduplicationId: string) {
  return {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    deduplication: { id: deduplicationId, keepLastIfActive: true },
    removeOnComplete: { age: DAY_SECONDS },
    removeOnFail: { age: 7 * DAY_SECONDS },
  }
}
