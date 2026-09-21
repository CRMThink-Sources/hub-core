import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'

const MAX_QUOTE_LENGTH = 120
const GENERIC_REPLY_FALLBACK = '>>↩ Resposta a mensagem anterior'

export type ThinkzapMessageQuoteInputType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'STICKER'
  | 'CONTACT'

export type ThinkzapMessageQuoteInput = {
  type: ThinkzapMessageQuoteInputType
  text?: string
  fileName?: string
  bitrixMessageId?: string
  bitrixChatId?: string
}

export function sanitizeQuoteText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim()
}

export function truncate(text: string, max = MAX_QUOTE_LENGTH): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

export function buildReplyQuote(
  cached: ThinkzapMessageQuoteInput | null,
): string | null {
  if (!cached) return null

  const body = renderQuoteBody(cached)
  const safe = truncate(sanitizeQuoteText(body))

  if (cached.bitrixMessageId && cached.bitrixChatId) {
    return `>>[context=chat${cached.bitrixChatId}/${cached.bitrixMessageId}]${safe}[/context]`
  }

  return `>>${safe}`
}

function renderQuoteBody(cached: ThinkzapMessageQuoteInput): string {
  switch (cached.type) {
    case 'TEXT':
      return cached.text ?? ''
    case 'IMAGE':
      return cached.text ? `📷 Imagem: ${cached.text}` : '📷 Imagem'
    case 'VIDEO':
      return cached.text ? `🎥 Vídeo: ${cached.text}` : '🎥 Vídeo'
    case 'AUDIO':
      return '🎧 Áudio'
    case 'DOCUMENT': {
      const label = cached.fileName ? `📎 ${cached.fileName}` : '📎 Documento'
      return cached.text ? `${label}: ${cached.text}` : label
    }
    case 'STICKER':
      return '🎭 Sticker'
    case 'CONTACT':
      return cached.text ? `📇 ${cached.text}` : '📇 Contato'
    default:
      return ''
  }
}

type BuildMessageTextWithReplyInput = {
  event: ReceivedMessageEvent
  cached: ThinkzapMessageQuoteInput | null
  baseText: string
}

export function buildMessageTextWithReply({
  event,
  cached,
  baseText,
}: BuildMessageTextWithReplyInput): string {
  if (!event.referenceMessageId) return baseText

  const quote = buildReplyQuote(cached)
  if (quote) return `${quote}\n${baseText}`
  return `${GENERIC_REPLY_FALLBACK}\n${baseText}`
}

export function extractQuoteInput(
  event: ReceivedMessageEvent,
): ThinkzapMessageQuoteInput {
  if (event.image) {
    return { type: 'IMAGE', text: event.image.caption || undefined }
  }
  if (event.video) {
    return { type: 'VIDEO', text: event.video.caption || undefined }
  }
  if (event.audio) {
    return { type: 'AUDIO' }
  }
  if (event.document) {
    return {
      type: 'DOCUMENT',
      // A legenda é o que o contato escreveu; sem ela aqui, a citação de um
      // documento comentado mostraria só o nome do arquivo, e o registro no
      // banco gravaria `text = null`.
      text: event.document.caption || undefined,
      fileName: event.document.fileName || undefined,
    }
  }
  if (event.sticker) {
    return { type: 'STICKER' }
  }
  if (event.contact) {
    return { type: 'CONTACT', text: event.contact.displayName || undefined }
  }
  if (event.buttonReply) {
    return { type: 'TEXT', text: event.buttonReply.message || '' }
  }
  return { type: 'TEXT', text: event.text?.message || '' }
}

export function getQuoteInputType(
  cached: ThinkzapMessageQuoteInput | null,
): ThinkzapMessageQuoteInputType | 'unknown' {
  return cached?.type ?? 'unknown'
}
