import type { $ZodIssue } from 'zod/v4/core'

/** Item da SPA de produtos veio com shape inesperado do Bitrix. */
export class InvalidBitrixProductError extends Error {
  constructor(readonly issues: $ZodIssue[]) {
    const fields = issues.map(i => i.path.join('.')).join(', ')
    super(`Produto da SPA do Bitrix com shape inválido (campos: ${fields})`)
    this.name = 'InvalidBitrixProductError'
  }
}
