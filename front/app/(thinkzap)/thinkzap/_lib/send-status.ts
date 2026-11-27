/**
 * Estados de entrega de um envio, como a API devolve (`recipientState`).
 * `UNKNOWN` = sem confirmação do provedor: a UI manda conferir antes de reenviar.
 */
export const SEND_STATUSES = [
  'WAITING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'PARTIAL',
  'UNKNOWN',
] as const

export type SendStatus = (typeof SEND_STATUSES)[number]

export function isSendStatus(value: unknown): value is SendStatus {
  return (
    typeof value === 'string' &&
    (SEND_STATUSES as readonly string[]).includes(value)
  )
}

export type SendStatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'read'
  | 'danger'
  | 'warning'

export type SendStatusView = {
  /** Chave de tradução relativa ao namespace da aba (`envios.json`). */
  labelKey: `status.${string}`
  tone: SendStatusTone
  /** Classes Tailwind do selo (fundo + texto + borda), todas literais para o JIT enxergar. */
  badgeClassName: string
}

/**
 * Cor por estado. Lido junto com o texto do rótulo: a cor nunca é o único
 * sinal (daltonismo). `PARTIAL` e `UNKNOWN` usam âmbar porque pedem atenção,
 * mas não são falha confirmada.
 */
const STATUS_VIEW: Record<SendStatus, SendStatusView> = {
  WAITING: {
    labelKey: 'status.waiting',
    tone: 'neutral',
    badgeClassName: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  SENT: {
    labelKey: 'status.sent',
    tone: 'info',
    badgeClassName: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  DELIVERED: {
    labelKey: 'status.delivered',
    tone: 'success',
    badgeClassName: 'bg-green-50 text-green-700 border-green-200',
  },
  READ: {
    labelKey: 'status.read',
    tone: 'read',
    badgeClassName: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  FAILED: {
    labelKey: 'status.failed',
    tone: 'danger',
    badgeClassName: 'bg-red-50 text-red-700 border-red-200',
  },
  PARTIAL: {
    labelKey: 'status.partial',
    tone: 'warning',
    badgeClassName: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  UNKNOWN: {
    labelKey: 'status.unknown',
    tone: 'warning',
    badgeClassName: 'bg-amber-50 text-amber-800 border-amber-200',
  },
}

/** Estado desconhecido para a UI (API mais nova que o front) cai em `UNKNOWN`. */
export function sendStatusView(status: string): SendStatusView {
  return isSendStatus(status) ? STATUS_VIEW[status] : STATUS_VIEW.UNKNOWN
}
