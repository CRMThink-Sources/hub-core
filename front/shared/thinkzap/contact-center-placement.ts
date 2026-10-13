/**
 * O que `/thinkzap/connector/list` devolve por linha — só os campos que o
 * placement do Contact Center usa.
 */
export type ContactCenterLine = {
  id: string
  phoneData: { phone?: string | null; name?: string | null } | null
  instance: { name: string | null; vinculatedChannel: string | null }
}

export type ContactCenterLineOption = {
  id: string
  label: string
  /** A linha já é a deste canal aberto. */
  linkedHere: boolean
}

/**
 * O canal aberto de onde o placement foi aberto.
 *
 * O handler do conector recebe `LINE`; `LINE_ID` é o nome em outros placements de
 * linha aberta e fica como fallback. `options` chega como objeto, mas há portais
 * que a entregam serializada — por isso o parse protegido.
 */
export function resolvePlacementLine(
  info: { options?: unknown } | null | undefined,
): number | null {
  const options = parseOptions(info?.options)
  if (!options) return null

  const raw = options.LINE ?? options.LINE_ID
  if (raw === undefined || raw === null || raw === '') return null

  const line = Number(raw)
  return Number.isInteger(line) && line > 0 ? line : null
}

function parseOptions(options: unknown): Record<string, unknown> | null {
  if (typeof options === 'string') {
    try {
      const parsed: unknown = JSON.parse(options)
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return isRecord(options) ? options : null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Rótulo de cada linha e a pré-seleção: a linha já vinculada a este canal, se
 * houver. Sem `phoneData` (linha desconectada no provider) cai no nome da linha —
 * ela ainda pode ser vinculada, igual à tela da linha.
 */
export function toLineOptions(
  lines: ContactCenterLine[],
  placementLine: number | null,
): { options: ContactCenterLineOption[]; preselectedId: string } {
  const channel = placementLine === null ? null : String(placementLine)

  const options = lines.map(line => ({
    id: line.id,
    label: lineLabel(line),
    linkedHere: channel !== null && line.instance.vinculatedChannel === channel,
  }))

  return {
    options,
    preselectedId: options.find(option => option.linkedHere)?.id ?? '',
  }
}

function lineLabel(line: ContactCenterLine): string {
  const phone = line.phoneData?.phone?.trim()
  const name = line.phoneData?.name?.trim()
  if (phone) return name ? `${phone} — ${name}` : phone
  return line.instance.name?.trim() || 'Linha sem nome'
}
