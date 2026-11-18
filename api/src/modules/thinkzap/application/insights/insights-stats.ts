// O painel é lido no horário de Brasília: dia, hora e dia da semana de cada
// conversa saem nesse fuso, não no do servidor.
const TZ = 'America/Sao_Paulo'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  hour: 'numeric',
  hour12: false,
})
const clockFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
})

/**
 * Número utilizável ou null. Datas inválidas vindas do Bitrix viram NaN nas
 * esperas; um NaN numa mediana ou média contamina o painel inteiro.
 */
export const finite = (x: number | null | undefined): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? x : null

export const median = (a: number[]): number | null => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Percentual com uma casa; sem base devolve null (o front mostra "—"). */
export const pct = (n: number, d: number): number | null =>
  d ? Math.round((n / d) * 1000) / 10 : null

export const avg = (a: number[]): number | null =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : null

/** `YYYY-MM-DD` no horário de Brasília. */
export const fmtDay = (iso: string | Date): string =>
  dayFmt.format(new Date(iso))

const partsOf = (fmt: Intl.DateTimeFormat, iso: string | Date) =>
  Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map(x => [x.type, x.value]),
  ) as Partial<Record<Intl.DateTimeFormatPartTypes, string>>

/** Dia da semana (0 = domingo) e hora no horário de Brasília. */
export function localParts(iso: string): { dow: number; hour: number } {
  const p = partsOf(partsFmt, iso)
  // hour12:false pode devolver "24" à meia-noite; % 24 normaliza.
  return { dow: WEEKDAYS.indexOf(p.weekday ?? ''), hour: Number(p.hour) % 24 }
}

/** Minutos desde a meia-noite (Brasília). */
export function clockMin(iso: string): number {
  const p = partsOf(clockFmt, iso)
  return (Number(p.hour) % 24) * 60 + Number(p.minute)
}

/** Chave do agrupamento do relatório: dia, semana (segunda), mês ou total. */
export function bucketKey(iso: string, g: string): string {
  const d = fmtDay(iso)
  if (g === 'day') return d
  if (g === 'month') return d.slice(0, 7)
  if (g === 'week') {
    const dt = new Date(d + 'T12:00:00Z')
    const dow = (dt.getUTCDay() + 6) % 7
    dt.setUTCDate(dt.getUTCDate() - dow)
    return dt.toISOString().slice(0, 10)
  }
  return 'total'
}
