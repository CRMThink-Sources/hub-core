/** Campos de expediente do `imopenlines.config.get`. */
export type OpenLineWorktime = {
  WORKTIME_ENABLE?: unknown
  /** Hora decimal: `18.3` é 18:30. */
  WORKTIME_FROM?: unknown
  WORKTIME_TO?: unknown
  WORKTIME_TIMEZONE?: unknown
  /** Dias da semana, domingo em `0`. */
  WORKTIME_DAYOFF?: unknown
  /** Formato `dd.mm`. */
  WORKTIME_HOLIDAYS?: unknown
}

type Momento = { minutos: number; diaSemana: number; dia: number; mes: number }

/** O que não dá para afirmar vira `true`: fechar por engano cala o bot no expediente. */
export function isWithinWorkingHours(
  config: OpenLineWorktime | null | undefined,
  agora: Date = new Date(),
): boolean {
  if (!config) return true
  if (texto(config.WORKTIME_ENABLE) !== 'Y') return true

  const momento = momentoNoFuso(agora, texto(config.WORKTIME_TIMEZONE))
  if (!momento) return true

  if (ehFeriado(config.WORKTIME_HOLIDAYS, momento)) return false
  if (ehFolga(config.WORKTIME_DAYOFF, momento.diaSemana)) return false

  const inicio = minutosDaHora(config.WORKTIME_FROM)
  const fim = minutosDaHora(config.WORKTIME_TO)
  if (inicio === null || fim === null) return true

  // Janela que vira o dia (22:00 → 06:00).
  if (fim <= inicio) return momento.minutos >= inicio || momento.minutos <= fim

  return momento.minutos >= inicio && momento.minutos <= fim
}

/** `9` → 540, `18.3` → 1110. A parte da direita é minuto, não fração. */
function minutosDaHora(raw: unknown): number | null {
  const valor = texto(raw)
  if (!valor) return null

  // `:` além do `.`: o portal documenta ponto, mas o campo é livre no painel.
  const [horaRaw, minutoRaw = ''] = valor.split(/[.:]/)
  const hora = Number(horaRaw)
  const minuto = minutoRaw ? Number(minutoRaw.padEnd(2, '0')) : 0

  if (!Number.isFinite(hora) || !Number.isFinite(minuto)) return null
  if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null

  return hora * 60 + minuto
}

function ehFolga(raw: unknown, diaSemana: number): boolean {
  return lista(raw).some(item => {
    const dia = Number(item)
    // `% 7`: o portal manda tanto `0` quanto `7` para domingo.
    return Number.isFinite(dia) && dia % 7 === diaSemana
  })
}

function ehFeriado(raw: unknown, momento: Momento): boolean {
  return lista(raw).some(item => {
    const [dia, mes] = item.split('.').map(Number)
    return dia === momento.dia && mes === momento.mes
  })
}

/** `Intl` e não offset fixo: o expediente atravessa horário de verão. */
function momentoNoFuso(agora: Date, timeZone: string): Momento | null {
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || undefined,
      hour12: false,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(agora)

    const pegar = (type: Intl.DateTimeFormatPartTypes) =>
      partes.find(parte => parte.type === type)?.value ?? ''

    const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const diaSemana = semana.indexOf(pegar('weekday'))
    // `hour12: false` devolve `24` à meia-noite em algumas implementações.
    const hora = Number(pegar('hour')) % 24
    const minuto = Number(pegar('minute'))

    if (diaSemana < 0 || !Number.isFinite(hora) || !Number.isFinite(minuto)) {
      return null
    }

    return {
      minutos: hora * 60 + minuto,
      diaSemana,
      dia: Number(pegar('day')),
      mes: Number(pegar('month')),
    }
  } catch {
    return null
  }
}

function texto(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/** O portal manda `[""]` para lista vazia. */
function lista(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(item => {
    const valor = texto(item)
    return valor ? [valor] : []
  })
}
