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

/**
 * Eventos que **todo** webhook de canal nosso precisa assinar.
 *
 * `MESSAGE_RECEIVED` entrega a mensagem do contato. `MESSAGE_DELIVERY` entrega o
 * desfecho do que **nós** enviamos: o `POST /messages` responde `200` antes de a Meta
 * processar, então uma recusa (número sem aprovação de display name, janela fechada,
 * número inválido) chega só por aqui. Sem este evento, mensagem que a Meta rejeita
 * aparece como entregue no canal aberto e o contato nunca recebe nada.
 *
 * Constante, e não array literal em cada ponto de criação: eram duas cópias — o
 * provisionamento do conector e a conclusão da conexão do canal — e duas cópias é
 * como uma delas fica para trás na próxima mudança, deixando parte dos canais surda
 * para o evento novo.
 *
 * Canais provisionados antes desta lista existir têm webhook só com
 * `MESSAGE_RECEIVED` e precisam ser reconfigurados à mão no painel da HubMessage: a
 * API só expõe `POST /webhooks`, sem leitura nem atualização.
 */
export const HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS: HubMessageWebhookEvent[] = [
  'MESSAGE_RECEIVED',
  'MESSAGE_DELIVERY',
]

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
 * Envio de **template aprovado**: mesma rota de mensagens do canal
 * (`POST /v1/channels/{channelId}/messages`), com `content.type = 'TEMPLATE'`.
 *
 * FORMATO CONFIRMADO por envio real em 2026-08-06 — a doc pública
 * (`https://developer.hubmessage.io/messages/introduction`) descreve só mensagem
 * livre, então este shape saiu de tentativa contra a API.
 *
 * Três coisas que **nenhuma** documentação sugeria, e que é por isso que estão
 * anotadas aqui:
 *
 * 1. O template vai dentro de `content.attachments[0].template` — a API reaproveita
 *    o array de anexos da mensagem livre, e não aceita `content.template` direto.
 *    Foi o que devolvia `502 {"error":"barling returned status 502"}`.
 * 2. `language` é **objeto** (`{ policy, code }`), não string — e diverge das rotas
 *    de catálogo (`/whatsapp/businesses/{wabaId}/templates`), onde o mesmo idioma é
 *    string crua. `policy: 'deterministic'` é o que a Meta usa para "não faça
 *    fallback de idioma".
 * 3. `components[].type` é **MAIÚSCULO** (`BODY`), como no cadastro — apesar de a
 *    Cloud API da Meta aceitar minúsculo no envio.
 */
export type HubMessageTemplateSendParameter = {
  type: 'text'
  text: string
}

export type HubMessageTemplateSendComponent = {
  type: 'BODY'
  parameters: HubMessageTemplateSendParameter[]
}

export type SendHubMessageTemplateParams = {
  recipient: {
    /** Telefone do destinatário (DDI + DDD + número). */
    identifier: string
  }
  content: {
    type: 'TEMPLATE'
    /** Um item só: a API aceita o array, mas o template é um. */
    attachments: Array<{
      template: {
        /** Nome do template aprovado, como cadastrado na Meta. */
        name: string
        language: {
          /** `deterministic` = enviar exatamente neste idioma, sem fallback. */
          policy: 'deterministic'
          /** Ex.: `pt_BR`. */
          code: string
        }
        /**
         * Parâmetros do corpo, na ordem posicional. Omitido em template sem
         * variável.
         */
        components?: HubMessageTemplateSendComponent[]
      }
    }>
  }
}

/**
 * Resposta do envio de template — igual à do envio livre, e `messageId` é o
 * **único** campo que vem (confirmado em 2026-08-06). É ele que vira
 * `providerMessageId` e correlaciona o webhook de status.
 */
export type SendHubMessageTemplateResponse = {
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
