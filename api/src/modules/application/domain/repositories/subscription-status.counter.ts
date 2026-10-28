/**
 * Quantas assinaturas da SPA 1142 estão em cada status que o painel do backoffice
 * mostra. `countedAt` é o instante da contagem — vem junto porque o resultado pode
 * sair de cache, e quem mostra precisa saber de quando é.
 */
export type SubscriptionStatusCounts = {
  active: number
  pastDue: number
  trialing: number
  countedAt: Date
}

export interface SubscriptionStatusCounter {
  count(): Promise<SubscriptionStatusCounts>
}
