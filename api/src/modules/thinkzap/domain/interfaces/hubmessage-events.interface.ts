/**
 * Tipos do webhook da HubMessage (WhatsApp Oficial).
 * Referência: https://developer.hubmessage.io/webhooks/payloads
 *
 * O corpo entregue no webhook é o envelope `{ message, messageEventType }`;
 * o objeto útil é o `message` interno.
 */

export type HubMessageMetadata = {
  from_me: boolean
  from_api?: boolean
  forwarded?: boolean
  middleware?: string
  /** Epoch ms do momento da mensagem no WhatsApp. */
  moment?: number
}

export type HubMessageParty = {
  identifier: string
  name?: string
}

export type HubMessageTextContent = {
  type: 'TEXT'
  identifier?: string
  message: string
}

export type HubMessageContactItem = {
  name?: string
  first_name?: string
  last_name?: string
  phones?: string[]
}

export type HubMessageContactArrayContent = {
  type: 'CONTACT_ARRAY'
  identifier?: string
  contacts: HubMessageContactItem[]
}

export type HubMessageButton = {
  id?: string
  title?: string
  /** `BUTTON` no INTERACTIVE_BUTTON; `URL` ou `CALL` no INTERACTIVE_ACTION. */
  type?: string
  url?: string
  phone?: string
}

export type HubMessageInteractiveButtonContent = {
  type: 'INTERACTIVE_BUTTON'
  identifier?: string
  message: string
  buttons?: HubMessageButton[]
  thumbnail?: string
}

export type HubMessageInteractiveActionContent = {
  type: 'INTERACTIVE_ACTION'
  identifier?: string
  message: string
  buttons?: HubMessageButton[]
  header?: { message?: string }
  footer?: { message?: string }
}

export type HubMessageContent =
  | HubMessageTextContent
  | HubMessageContactArrayContent
  | HubMessageInteractiveButtonContent
  | HubMessageInteractiveActionContent

export type HubMessageAttachmentType =
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'STICKER'
  | 'DOCUMENT'

export type HubMessageAttachment = {
  type: HubMessageAttachmentType
  url: string
  /** Presente em IMAGE e VIDEO. */
  caption?: string
  thumbnail_url?: string
  /** Não documentado, mas esperado num eventual DocumentAttachment. */
  file_name?: string
  identifier?: string
}

export type HubMessageWebhookMessage = {
  _id: string
  tenant?: string
  tenant_owner?: string
  channel_id: string
  chat_id?: string
  created_by?: string
  /** Epoch ms. */
  created: number
  metadata?: HubMessageMetadata
  sender: HubMessageParty
  recipient?: HubMessageParty
  contents?: HubMessageContent[]
  attachments?: HubMessageAttachment[]
}

export type HubMessageWebhookEnvelope = {
  message: HubMessageWebhookMessage
  messageEventType: string
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isHubMessageWebhookEnvelope(
  body: unknown,
): body is HubMessageWebhookEnvelope {
  if (typeof body !== 'object' || body === null) return false

  const { message } = body as { message?: unknown }
  if (typeof message !== 'object' || message === null) return false

  const { _id, channel_id, sender } = message as {
    _id?: unknown
    channel_id?: unknown
    sender?: unknown
  }

  if (!isNonEmptyString(_id) || !isNonEmptyString(channel_id)) return false

  if (typeof sender !== 'object' || sender === null) return false
  return isNonEmptyString((sender as { identifier?: unknown }).identifier)
}
