export type LineAccess = {
  /** `true` = há grupos na instalação e o usuário só usa as linhas de `allowedLineIds`. */
  restricted: boolean
  /** Só vale com `restricted`; vazio significa nenhuma linha liberada. */
  allowedLineIds: string[]
}

/**
 * Regra dos grupos de acesso do widget.
 *
 * - Sem nenhum grupo na instalação: ninguém é restringido (comportamento anterior
 *   aos grupos).
 * - Com ao menos um grupo: vale a união das linhas dos grupos do usuário. Quem não
 *   está em nenhum grupo — ou está só em grupos sem linhas — fica sem linha.
 *
 * O cruzamento com as linhas elegíveis para envio (ativas, com provider) é feito por
 * quem conhece o contexto da instalação; aqui só se decide o que os grupos liberam.
 */
export function resolveLineAccess(input: {
  hasGroups: boolean
  userLineIds: string[]
}): LineAccess {
  if (!input.hasGroups) return { restricted: false, allowedLineIds: [] }
  return {
    restricted: true,
    allowedLineIds: [...new Set(input.userLineIds)],
  }
}

export function isLineAllowed(
  access: LineAccess,
  subscriptionItemId: string,
): boolean {
  return (
    !access.restricted || access.allowedLineIds.includes(subscriptionItemId)
  )
}
