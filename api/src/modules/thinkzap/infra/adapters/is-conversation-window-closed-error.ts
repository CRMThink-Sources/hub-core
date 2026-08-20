import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'

/**
 * Identifica a rejeição de mensagem livre por janela de conversa de 24h fechada.
 *
 * Fora da janela, nenhuma retentativa passa — só um template aprovado. Por isso
 * o chamador usa este classificador para NÃO retentar e avisar o operador.
 *
 * DEFAULT CONSERVADOR: retorna `false` em qualquer dúvida. Um falso positivo
 * engoliria uma falha transitória e o operador perderia a mensagem sem retry;
 * um falso negativo apenas mantém o comportamento atual (retenta e desiste).
 *
 * A doc pública da HubMessage só especifica 200 e 401 nos endpoints de mensagem
 * — o status/código exato da janela fechada não está documentado (ver Open
 * Questions do design). Enquanto não confirmado, o matcher exige status E corpo,
 * nunca só status.
 */

const WINDOW_CLOSED_STATUSES = new Set([400, 422])

const WINDOW_CLOSED_PATTERNS = [
  /janela/i,
  /window/i,
  /24\s*h/i,
  /template/i,
  /outside/i,
  /expired/i,
  /reengagement/i,
  /re-engagement/i,
]

export function isConversationWindowClosedError(error: unknown): boolean {
  if (!(error instanceof HubMessageApiError)) return false
  if (error.status === undefined) return false
  if (!WINDOW_CLOSED_STATUSES.has(error.status)) return false

  const body = extractBodyText(error.body)
  if (!body) return false

  return WINDOW_CLOSED_PATTERNS.some(pattern => pattern.test(body))
}

function extractBodyText(body: unknown): string | null {
  if (typeof body === 'string') return body
  if (typeof body !== 'object' || body === null) return null

  const { message, error: errorField } = body as {
    message?: unknown
    error?: unknown
  }

  const parts = [message, errorField].filter(
    (part): part is string => typeof part === 'string',
  )

  return parts.length > 0 ? parts.join(' ') : null
}
