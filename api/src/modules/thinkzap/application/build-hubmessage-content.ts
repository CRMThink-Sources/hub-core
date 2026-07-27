import type {
  HubMessageAttachment,
  HubMessageContactItem,
  HubMessageContent,
  HubMessageWebhookMessage,
} from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'

export type HubMessageThinkzapType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'DOCUMENT'
  | 'STICKER'
  | 'CONTACT'

export type HubMessageBuiltContent = {
  text: string
  files?: { url: string; name: string }[]
  type: HubMessageThinkzapType
  fileName?: string
}

const ATTACHMENT_DEFAULTS: Record<
  HubMessageAttachment['type'],
  { type: HubMessageThinkzapType; name: string }
> = {
  IMAGE: { type: 'IMAGE', name: 'Imagem' },
  VIDEO: { type: 'VIDEO', name: 'Mensagem de vídeo.mp4' },
  AUDIO: { type: 'AUDIO', name: 'Mensagem de áudio.mp3' },
  STICKER: { type: 'STICKER', name: 'Sticker.webp' },
  DOCUMENT: { type: 'DOCUMENT', name: 'Documento' },
}

/**
 * Traduz o payload da HubMessage para o que o Bitrix precisa em
 * `imconnector.send.messages`. Função pura: sem I/O.
 *
 * Texto e mídia vêm de arrays diferentes (`contents[]` e `attachments[]`) e
 * podem coexistir — uma imagem com legenda tem o arquivo em `attachments[0]` e
 * a legenda no próprio anexo, não em `contents`.
 *
 * Retorna `null` quando não há nada enviável (tipo desconhecido); o chamador
 * trata isso como descarte, não como erro.
 */
export function buildHubMessageContent(
  message: HubMessageWebhookMessage,
): HubMessageBuiltContent | null {
  const attachment = findSupportedAttachment(message.attachments)
  if (attachment) {
    const defaults = ATTACHMENT_DEFAULTS[attachment.type]
    const fileName = attachment.file_name || defaults.name
    return {
      text: attachment.caption?.trim() || '',
      files: [{ url: attachment.url, name: fileName }],
      type: defaults.type,
      fileName,
    }
  }

  const content = findSupportedContent(message.contents)
  if (!content) return null

  switch (content.type) {
    case 'TEXT':
      return { text: content.message ?? '', type: 'TEXT' }

    case 'CONTACT_ARRAY':
      return { text: buildContactArrayText(content.contacts), type: 'CONTACT' }

    case 'INTERACTIVE_BUTTON':
    case 'INTERACTIVE_ACTION': {
      const lines = [content.message ?? '']
      const buttons = content.buttons ?? []
      for (const button of buttons) {
        if (!button.title) continue
        if (button.type === 'URL' && button.url) {
          lines.push(`🔘 ${button.title}: ${button.url}`)
        } else if (button.type === 'CALL' && button.phone) {
          lines.push(`🔘 ${button.title}: 📞 ${button.phone}`)
        } else {
          lines.push(`🔘 ${button.title}`)
        }
      }
      return { text: lines.join('\n').trim(), type: 'TEXT' }
    }
  }
}

function findSupportedAttachment(
  attachments: HubMessageAttachment[] | undefined,
): HubMessageAttachment | null {
  if (!attachments?.length) return null
  return (
    attachments.find(
      item => item?.url && item.type in ATTACHMENT_DEFAULTS,
    ) ?? null
  )
}

function findSupportedContent(
  contents: HubMessageContent[] | undefined,
): HubMessageContent | null {
  if (!contents?.length) return null
  const supported: HubMessageContent['type'][] = [
    'TEXT',
    'CONTACT_ARRAY',
    'INTERACTIVE_BUTTON',
    'INTERACTIVE_ACTION',
  ]
  return contents.find(item => supported.includes(item?.type)) ?? null
}

function buildContactArrayText(contacts: HubMessageContactItem[]): string {
  const blocks = contacts.map(contact => {
    const name =
      contact.name ||
      [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
      'Contato'
    const phones = (contact.phones ?? []).map(phone => `📞 ${phone}`).join('\n')
    return `🛍️[b]${name}[/b]\n${phones}`
  })

  return `------------------------\n Contato encaminhado:\n${blocks.join('\n')}`
}
