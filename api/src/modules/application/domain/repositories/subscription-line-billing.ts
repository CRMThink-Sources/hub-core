/**
 * Uma linha (item da SPA 1146) em que a verificação de assinaturas mexeu no provider,
 * ou tentou e falhou.
 */
export type SubscriptionLineBillingResult = {
  itemId: string
  subscriptionId: string
  /** `null` quando a falha veio antes de saber o provider (item ilegível, sem credencial). */
  provider: 'ZAPI' | 'HUBMESSAGE' | null
  action: 'unsubscribed' | 'subscribed'
  succeeded: boolean
  error?: string
}

/**
 * A cobrança das linhas no provider, do ponto de vista da verificação de assinaturas.
 * A regra de cada linha (marca, credencial, idempotência) é do thinkzap; aqui só entra
 * o que a verificação precisa pedir e registrar.
 *
 * Falha numa linha não lança: vira um resultado `succeeded: false`, e as outras linhas
 * seguem. A pausa do Bitrix lança, porque vale para o portal inteiro.
 */
export interface SubscriptionLineBilling {
  /**
   * Desassina as linhas da assinatura manual vencida há 5 dias. Devolve só as linhas
   * desassinadas agora ou que falharam — as que já tinham a marca não aparecem.
   */
  unsubscribeLinesForPastDue(
    subscriptionId: string,
  ): Promise<SubscriptionLineBillingResult[]>
  /**
   * Chama o subscribe em cada linha ativa das assinaturas informadas (as `active`).
   * `checked` conta as linhas verificadas; `results` traz só as assinadas agora — o
   * provider disse que não estavam pagas — e as que falharam.
   */
  reconcileActiveLines(activeSubscriptionIds: string[]): Promise<{
    checked: number
    results: SubscriptionLineBillingResult[]
  }>
}
