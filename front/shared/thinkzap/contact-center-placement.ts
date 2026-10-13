/**
 * O que `/thinkzap/connector/list` devolve por linha — só os campos que o
 * placement do Contact Center usa.
 */
export type ContactCenterLine = {
  id: string
  phoneData: { phone?: string | null; name?: string | null } | null
  instance: { name: string | null; vinculatedChannel: string | null }
}

/**
 * Os helpers devolvem dados, não texto: o rótulo final é montado pela tela, no
 * idioma dela. `null` em `label`/`name` é "sem nome" — a tela traduz.
 */
export type ContactCenterLineOption = {
  id: string
  label: string | null
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

function lineLabel(line: ContactCenterLine): string | null {
  const phone = line.phoneData?.phone?.trim()
  const name = line.phoneData?.name?.trim()
  if (phone) return name ? `${phone} — ${name}` : phone
  return line.instance.name?.trim() || null
}

/** O que `/thinkzap/openchannels` devolve por canal. */
export type ContactCenterChannel = {
  id: string | number
  active: boolean
  name?: string | null
}

export type ContactCenterChannelOption = {
  id: string
  name: string | null
  active: boolean
  /** Linha que já ocupa o canal, se houver; `label` `null` é linha sem nome. */
  occupiedBy: { label: string | null } | null
}

/**
 * Canais abertos para o seletor e a pré-seleção.
 *
 * O `LINE` do placement **não** é a escolha do usuário: o Bitrix manda um canal
 * mesmo quando o usuário clica em "Conectar" sem escolher nenhum — é o que o
 * painel dele deixa selecionado por padrão. Usá-lo como destino vinculava a linha
 * a um canal que ninguém escolheu. Ele só pré-seleciona quando uma linha já está
 * vinculada a ele: aí é "Alterar", e o vínculo gravado confirma o canal.
 */
export function toChannelOptions(
  channels: ContactCenterChannel[],
  lines: ContactCenterLine[],
  placementLine: number | null,
): { options: ContactCenterChannelOption[]; preselectedChannelId: string } {
  const occupants = new Map<string, { label: string | null }>()
  for (const line of lines) {
    const channel = line.instance.vinculatedChannel
    if (channel && !occupants.has(channel)) {
      occupants.set(channel, { label: lineLabel(line) })
    }
  }

  const options = channels.map(channel => {
    const id = String(channel.id)
    return {
      id,
      name: channel.name?.trim() || null,
      active: channel.active,
      occupiedBy: occupants.get(id) ?? null,
    }
  })

  const placement = placementLine === null ? null : String(placementLine)
  const preselectedChannelId =
    placement !== null &&
    occupants.has(placement) &&
    options.some(option => option.id === placement)
      ? placement
      : ''

  return { options, preselectedChannelId }
}
