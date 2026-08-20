import type { $ZodIssue } from 'zod/v4/core'

/** Item da SPA de itens de assinatura veio com shape inesperado do Bitrix. */
export class InvalidBitrixSubscriptionItemError extends Error {
  constructor(readonly issues: $ZodIssue[]) {
    const fields = issues.map(i => i.path.join('.')).join(', ')
    super(
      `Item de assinatura da SPA do Bitrix com shape inválido (campos: ${fields})`,
    )
    this.name = 'InvalidBitrixSubscriptionItemError'
  }
}
