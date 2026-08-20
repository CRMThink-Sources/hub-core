/** Item de assinatura não existe na SPA. */
export class SubscriptionItemNotFoundError extends Error {
  constructor(subscriptionItemId: string) {
    super(`Item de assinatura "${subscriptionItemId}" não encontrado`)
    this.name = 'SubscriptionItemNotFoundError'
  }
}
