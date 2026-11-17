/** Itens da SPA 1146 para a reconciliação diária. */
export interface ActiveSubscriptionItemLister {
  /** Itens `active` com o id da assinatura pai. */
  listActiveItems(): Promise<
    Array<{ itemId: string; subscriptionId: string | null }>
  >
  /**
   * Itens não excluídos que têm credencial de provider, de qualquer status. São os
   * candidatos a desassinar: só item com credencial tem recurso remoto cobrado.
   */
  listItemsWithCredential(): Promise<
    Array<{
      itemId: string
      subscriptionId: string | null
      status: 'active' | 'cancelled' | null
    }>
  >
}
