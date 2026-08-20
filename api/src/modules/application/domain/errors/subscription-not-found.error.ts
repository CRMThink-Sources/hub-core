/** Assinatura não existe na SPA. */
export class SubscriptionNotFoundError extends Error {
  constructor(subscriptionId: string) {
    super(`Assinatura "${subscriptionId}" não encontrada`)
    this.name = 'SubscriptionNotFoundError'
  }
}
