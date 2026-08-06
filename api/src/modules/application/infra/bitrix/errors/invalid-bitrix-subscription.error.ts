import type { $ZodIssue } from 'zod/v4/core'

/** Item da SPA de assinaturas veio com shape inesperado do Bitrix. */
export class InvalidBitrixSubscriptionError extends Error {
  constructor(readonly issues: $ZodIssue[]) {
    const fields = issues.map(i => i.path.join('.')).join(', ')
    super(`Assinatura da SPA do Bitrix com shape inválido (campos: ${fields})`)
    this.name = 'InvalidBitrixSubscriptionError'
  }
}
