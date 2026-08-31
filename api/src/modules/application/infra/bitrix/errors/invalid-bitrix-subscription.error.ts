import type { $ZodIssue } from 'zod/v4/core'

/** Item da SPA de assinaturas veio com shape inesperado do Bitrix. */
export class InvalidBitrixSubscriptionError extends Error {
  constructor(readonly issues: $ZodIssue[]) {
    /**
     * Caminho **e** motivo por issue. Só o campo não identifica o problema: um id
     * de enum novo criado no CRM e um campo vazio produzem a mesma mensagem, e o
     * valor recusado ficava apenas no issue descartado — o diagnóstico exigia
     * abrir o Bitrix para descobrir qual id era.
     */
    const details = issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    super(`Assinatura da SPA do Bitrix com shape inválido (${details})`)
    this.name = 'InvalidBitrixSubscriptionError'
  }
}
