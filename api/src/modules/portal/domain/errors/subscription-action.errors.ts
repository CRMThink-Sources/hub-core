export type SubscriptionActionRefusal =
  | 'gateway-managed'
  | 'already-active'
  | 'already-cancelled'

/**
 * Ativar ou inativar recusado sem escrever nada: assinatura Stripe (o gateway é a fonte
 * da verdade) ou transição para o estado em que ela já está.
 */
export class SubscriptionActionRefusedError extends Error {
  constructor(readonly reason: SubscriptionActionRefusal) {
    super(`Ação na assinatura recusada: ${reason}`)
    this.name = 'SubscriptionActionRefusedError'
  }
}

export type SubscriptionPeriodEndProblem =
  | 'period-end-required'
  | 'period-end-invalid'

/**
 * Novo fim de período ausente (o atual já terminou) ou não posterior a hoje. Sem ele, a
 * verificação de assinaturas marcaria `Vencido` de novo na rodada seguinte.
 */
export class SubscriptionPeriodEndError extends Error {
  constructor(readonly reason: SubscriptionPeriodEndProblem) {
    super(`Fim de período inválido: ${reason}`)
    this.name = 'SubscriptionPeriodEndError'
  }
}

/**
 * Assinatura que não pertence à instalação da URL. `404`, como a linha de outro cliente:
 * responder outra coisa vazaria a existência do recurso alheio.
 */
export class SubscriptionNotInAppError extends Error {
  constructor(subscriptionId: string) {
    super(`Assinatura "${subscriptionId}" não encontrada nesta instalação`)
    this.name = 'SubscriptionNotInAppError'
  }
}
