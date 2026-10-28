/** Itens `active` da SPA 1146 com o id da assinatura pai, para a reconciliação diária. */
export interface ActiveSubscriptionItemLister {
  listActiveItems(): Promise<
    Array<{ itemId: string; subscriptionId: string | null }>
  >
}
