import z from 'zod'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Campos comuns das listas de falhas (envio e recebimento): paginação, filtro de
 * cliente e período. Cada controller soma os filtros próprios e aplica o período com as
 * funções abaixo.
 */
export const failureListBaseShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Parte do nome do portal, para a tela geral. */
  domain: z.string().trim().min(1).max(255).optional(),
  /** O portal exato (`domainId`), para a página do cliente. */
  domainId: z.string().trim().min(1).max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}

/**
 * O período padrão e o máximo são o **prazo de guarda** das falhas (`retencao-falhas`):
 * pedir mais que isso consultaria dado que o expurgo já apagou.
 */
export function resolveFailureRange(
  query: { from?: Date; to?: Date },
  retentionDays: number,
): { from: Date; to: Date } {
  const to = query.to ?? new Date()
  const from = query.from ?? new Date(to.getTime() - retentionDays * DAY_MS)
  return { from, to }
}

export const FAILURE_RANGE_ORDER_MESSAGE = '`from` deve ser anterior a `to`'

export function failureRangeIsOrdered(range: {
  from: Date
  to: Date
}): boolean {
  return range.from <= range.to
}

export function failureRangeMessage(retentionDays: number): string {
  return `O período máximo é de ${retentionDays} dias, o prazo de guarda das falhas`
}

export function failureRangeWithinRetention(
  range: { from: Date; to: Date },
  retentionDays: number,
): boolean {
  return range.to.getTime() - range.from.getTime() <= retentionDays * DAY_MS
}
