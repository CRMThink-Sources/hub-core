export type HubMessageChannelType = 'META_WHATSAPP'

export type CreateHubMessageChannelParams = {
  name: string
  type: HubMessageChannelType
}

export type CreateHubMessageChannelResponse = {
  id: string
  name: string
  type: HubMessageChannelType
  status?: string
}

export type HubMessageWebhookEvent =
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_DELIVERY'
  | 'MESSAGE_STATUS'
  | 'RECEIVED_STATUS'
  | 'RECEIVED_AND_DELIVERY'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'PRESENCE_CHAT'
  | 'INITIAL_DATA'
  | 'BLOCK'

export type CreateHubMessageWebhookParams = {
  url: string
  events: HubMessageWebhookEvent[]
  description?: string
  signing?: boolean
}

export type CreateHubMessageWebhookResponse = {
  id: string
  channelId: string
  url: string
  events: HubMessageWebhookEvent[]
  status: 'ENABLED' | 'DISABLED'
  signing: boolean
  /** Retornado apenas na criação quando `signing = true`. */
  secret?: string
}

export type ConnectHubMessageChannelParams = {
  wabaId: string
  phoneId: string
  code: string
  coexistence: boolean
}

/** Uma WABA (WhatsApp Business Account) retornada por `GET /whatsapp/businesses`. */
export type HubMessageBusiness = {
  businessId: string
  name: string
  channelsCount: number
  connectedCount: number
  disconnectedCount: number
}

export type ListBusinessesResponse = {
  items: HubMessageBusiness[]
}

/**
 * Envio de mensagem livre: `POST /v1/channels/{channelId}/messages`.
 * Rota única para todos os tipos — o que muda é `content.type`.
 * Ref.: https://developer.hubmessage.io/messages/introduction
 *
 * A API não expõe `DOCUMENT` nem campo de referência a mensagem (reply).
 */
export type HubMessageSendContentType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO'

export type HubMessageSendAttachment = {
  url: string
  caption?: string
}

export type SendHubMessageParams = {
  recipient: {
    /** Telefone do destinatário (DDI + DDD + número). */
    identifier: string
  }
  content: {
    type: HubMessageSendContentType
    /** Presente em `TEXT`. */
    body?: { message: string }
    /** Presente em `IMAGE`, `AUDIO` e `VIDEO`. Mídia vai por URL, nunca embutida. */
    attachments?: HubMessageSendAttachment[]
  }
}

export type SendHubMessageResponse = {
  messageId: string
}

/**
 * Templates de mensagem (WhatsApp Oficial), escopados por WABA.
 * Ref.: https://developer.hubmessage.io/templates/introduction
 * Rotas: `/whatsapp/businesses/{wabaId}/templates` (list/create/sync).
 */
export type HubMessageTemplateCategory =
  | 'UTILITY'
  | 'MARKETING'
  | 'AUTHENTICATION'

export type HubMessageTemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** Componente cru do template retornado/enviado à API (estrutura varia por tipo). */
export type HubMessageTemplateComponent = {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  text?: string
  [key: string]: unknown
}

export type HubMessageTemplate = {
  id: string
  name: string
  status: HubMessageTemplateStatus
  category: HubMessageTemplateCategory
  language: string
  parameter_format?: string
  message_send_ttl_seconds?: number
  components: HubMessageTemplateComponent[]
}

/** `GET /whatsapp/businesses/{wabaId}/templates`. */
export type ListTemplatesResponse = {
  data: HubMessageTemplate[]
}

/** `POST /whatsapp/businesses/{wabaId}/templates`. */
export type CreateTemplateParams = {
  name: string
  category: HubMessageTemplateCategory
  language: string
  /** Permite à Meta reclassificar a categoria em vez de reprovar o template. */
  allow_category_change?: boolean
  /** `POSITIONAL` para variáveis `{{1}}`; `NAMED` para `{{nome}}`. */
  parameter_format?: 'POSITIONAL' | 'NAMED'
  components: HubMessageTemplateComponent[]
}

export type CreateTemplateResponse = {
  id: string
  status: HubMessageTemplateStatus
  category: HubMessageTemplateCategory
}

/** `POST /whatsapp/businesses/{wabaId}/templates/sync`. */
export type SyncTemplatesResponse = {
  data: HubMessageTemplate[]
  syncedCount?: number
  synced?: boolean
}
