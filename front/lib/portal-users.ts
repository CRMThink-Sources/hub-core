export type PortalUserSummary = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  /** ID do usuário no Bitrix24 da CRMThink; nulo quando não há vínculo. */
  bitrixUserId: number | null
  createdAt: string
}

export type ListPortalUsersResponse = {
  users: PortalUserSummary[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/** Maior valor que cabe na coluna INTEGER do banco. */
const MAX_BITRIX_USER_ID = 2_147_483_647

export type ParsedBitrixUserId =
  | { valid: true; value: number | null }
  | { valid: false }

/**
 * Lê o campo "ID no Bitrix": vazio é válido e significa "sem vínculo" (`null`); fora
 * isso só um inteiro positivo, o mesmo que a API aceita.
 */
export function parseBitrixUserId(raw: string): ParsedBitrixUserId {
  const text = raw.trim()
  if (text === '') return { valid: true, value: null }
  if (!/^\d+$/.test(text)) return { valid: false }

  const value = Number(text)
  if (value < 1 || value > MAX_BITRIX_USER_ID) return { valid: false }
  return { valid: true, value }
}
