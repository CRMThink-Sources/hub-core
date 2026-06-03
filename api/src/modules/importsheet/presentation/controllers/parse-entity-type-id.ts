/** Lê e valida o entityTypeId vindo da query string. Retorna null se ausente/inválido. */
export function parseEntityTypeId(raw: unknown): number | null {
  const value: unknown = Array.isArray(raw) ? (raw[0] as unknown) : raw
  if (typeof value !== 'string') return null
  const parsed = Number(value.trim())
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}
