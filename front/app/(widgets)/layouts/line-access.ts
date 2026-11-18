/**
 * Grupos de acesso do widget: filtro, pré-seleção e trava do seletor de linha.
 *
 * Lógica pura, fora do componente, para ser testável sem DOM. O servidor continua
 * sendo quem recusa o envio por linha não permitida; aqui só se evita oferecer ao
 * operador uma linha que ele não pode usar.
 */

/** Resposta de `GET /thinkzap/access/my-lines`. */
export type LineAccess = {
  /** `false` = a instalação não tem grupos: todas as linhas servem. */
  restricted: boolean
  /** Só vale com `restricted`. Pode trazer ids de linhas já excluídas. */
  allowedLineIds: string[]
}

export type LineSelection<T extends { id: string }> = {
  /** Linhas que o seletor oferece. */
  lines: T[]
  /** Linha que já abre selecionada; `''` quando o operador precisa escolher. */
  autoSelectedId: string
  /** Seletor travado (uma única linha permitida). */
  locked: boolean
  /** Instalação com grupos e nenhuma linha liberada ao usuário. */
  noAccess: boolean
}

/**
 * Cruza as linhas elegíveis para envio com o que os grupos liberam ao usuário.
 *
 * - Sem restrição (ou sem a resposta, `null`): as linhas elegíveis como estão, sem
 *   pré-seleção — o comportamento anterior aos grupos, mesmo com uma linha só.
 * - Restrito: só as permitidas. Id permitido que não está entre as elegíveis (linha
 *   excluída, bloqueada, sem provider) não aparece e não conta.
 * - Restrito com uma linha: abre selecionada e travada. Com duas ou mais, abre sem
 *   seleção. Com nenhuma, `noAccess`.
 */
export function applyLineAccess<T extends { id: string }>(
  eligibleLines: readonly T[],
  access: LineAccess | null,
): LineSelection<T> {
  if (!access || !access.restricted) {
    return {
      lines: [...eligibleLines],
      autoSelectedId: '',
      locked: false,
      noAccess: false,
    }
  }

  const allowed = new Set(access.allowedLineIds)
  const lines = eligibleLines.filter(line => allowed.has(line.id))
  const only = lines.length === 1 ? lines[0] : undefined

  return {
    lines,
    autoSelectedId: only?.id ?? '',
    locked: only !== undefined,
    noAccess: lines.length === 0,
  }
}
