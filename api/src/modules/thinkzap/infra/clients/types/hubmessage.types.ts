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
 * `CONNECTED`/`DISCONNECTED` alimentam o campo Conectado do item da linha na SPA
 * (`UF_CRM_93_CONNECTED`): sem eles, o CRM só saberia da conexão pela conclusão
 * síncrona do connect, e nunca de uma queda.
 *
 * Canais provisionados antes de um evento entrar nesta lista não o assinam. O script
 * `hubmessage:sync-channel-webhook-events` lista o webhook de cada canal e atualiza a
 * lista de eventos (`PATCH`) para incluir todos os daqui.
 */
export const HUBMESSAGE_CHANNEL_WEBHOOK_EVENTS: HubMessageWebhookEvent[] = [
  'MESSAGE_RECEIVED',
  'MESSAGE_DELIVERY',
  'CONNECTED',
  'DISCONNECTED',
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

/** Item de `GET /v1/channels/{channelId}/webhooks`. Só os campos que usamos. */
export type HubMessageWebhook = {
  id: string
  channelId: string
  url: string
  events: string[]
  status: 'ENABLED' | 'DISABLED'
}

/** `PATCH /v1/channels/{channelId}/webhooks/{webhookId}`: só o que for enviado muda. */
export type UpdateHubMessageWebhookParams = {
  url?: string
  /** **Substitui** a lista inteira — mande a união, nunca só o que falta. */
  events?: string[]
  status?: 'ENABLED' | 'DISABLED'
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

export type HubMessageTemplateCouponParameter = {
  type: 'coupon_code'
  coupon_code: string
}

/**
 * Valor de um botão dinâmico. Formato da Cloud API da Meta: `sub_type` em
 * minúsculo e `index` como **string** com a posição do botão no template. O `type`
 * em MAIÚSCULO segue a armadilha 3 acima. A doc da HubMessage não detalha botão no
 * envio — formato ainda a confirmar com envio real.
 */
export type HubMessageTemplateSendButtonComponent =
  | {
      type: 'BUTTON'
      sub_type: 'url'
      index: string
      parameters: [HubMessageTemplateSendParameter]
    }
  | {
      type: 'BUTTON'
      sub_type: 'copy_code'
      index: string
      parameters: [HubMessageTemplateCouponParameter]
    }

/**
 * Imagem do cabeçalho no envio. A doc da Z-API Omni
 * (`https://developer.omni.z-api.io`) diz que cabeçalho de mídia exige o parâmetro,
 * mas só exemplifica cabeçalho de texto; o formato segue o da Cloud API da Meta
 * (`{ type: 'image', image: { link } }`). FORMATO A CONFIRMAR com envio real — se
 * o `HEADER` maiúsculo for recusado, testar `header` minúsculo, como no exemplo
 * da doc nova.
 */
export type HubMessageTemplateImageParameter = {
  type: 'image'
  image: { link: string }
}

export type HubMessageTemplateSendComponent =
  | {
      type: 'HEADER'
      parameters: [HubMessageTemplateImageParameter]
    }
  | {
      type: 'BODY'
      parameters: HubMessageTemplateSendParameter[]
    }
  | HubMessageTemplateSendButtonComponent

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
         * Parâmetros do corpo, na ordem posicional, seguidos de um componente por
         * botão dinâmico. Omitido em template sem variável nem botão dinâmico.
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
 * Envio de mensagem com botões de ação: mesma rota de mensagens do canal
 * (`POST /v1/channels/{channelId}/messages`), com
 * `content.type = 'INTERACTIVE_ACTION'`.
 * Ref.: https://developer.hubmessage.io/messages/send-interactive-action
 *
 * FORMATO CONFIRMADO por envio real em 2026-09-15 — e a confirmação trouxe
 * más notícias: a doc pública documenta botão `CALL` e múltiplos botões, mas
 * a Cloud API da Meta (que a HubMessage repassa por trás) não tem nenhum dos
 * dois em mensagem de sessão livre — só template aprovado tem botão de
 * ligação, e o botão de URL da Meta (`cta_url`) é de um botão só. `CALL`
 * sozinho voltou `400` direto da Meta ("missing: action"); `CALL` combinado
 * com `URL` foi silenciosamente descartado, só o `URL` chegou. Por isso o
 * type abaixo só tem `URL`, e `assertValidButtonsForProvider` limita a
 * HUBMESSAGE a um botão só — ver `interactive-button-validation.ts`.
 */
export type HubMessageButtonActionType = 'URL'

export type HubMessageButtonAction = {
  id: string
  title: string
  name: HubMessageButtonActionType
  url: string
}

export type SendHubMessageInteractiveActionParams = {
  recipient: {
    /** Telefone do destinatário (DDI + DDD + número). */
    identifier: string
  }
  content: {
    type: 'INTERACTIVE_ACTION'
    header?: { message: string }
    body: { message: string }
    footer?: { message: string }
    attachments: HubMessageButtonAction[]
  }
}

export type SendHubMessageInteractiveActionResponse = {
  messageId: string
}

/**
 * Envio de resposta rápida: `content.type = 'INTERACTIVE_BUTTON'`, **rota
 * separada de `INTERACTIVE_ACTION`** — não é o mesmo botão com outro `name`,
 * é outro formato de mensagem. `attachments[]` só tem `id`/`title` (sem
 * `name`, sem `url`/`phone`): o espelho do que `INTERACTIVE_BUTTON` traz na
 * entrada (`HubMessageInteractiveButtonContent` em `hubmessage-events.interface.ts`),
 * que também não tem `header`/`footer` — por isso este type não os declara.
 *
 * FORMATO CONFIRMADO por envio real em 2026-09-18: a Meta aceita até
 * **3 botões** (limite do quick reply da Cloud API) — o 4º fez a Meta
 * recusar a mensagem inteira (diferente do `URL` duplicado, que a Meta
 * descarta em silêncio). Por isso `assertValidButtonsForProvider` limita
 * `REPLY` na HUBMESSAGE a 3 — ver `interactive-button-validation.ts`.
 */
export type HubMessageQuickReplyButtonAction = {
  id: string
  title: string
}

export type SendHubMessageInteractiveButtonParams = {
  recipient: {
    /** Telefone do destinatário (DDI + DDD + número). */
    identifier: string
  }
  content: {
    type: 'INTERACTIVE_BUTTON'
    body: { message: string }
    attachments: HubMessageQuickReplyButtonAction[]
  }
}

export type SendHubMessageInteractiveButtonResponse = {
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

/**
 * Botão do componente `BUTTONS` no cadastro — formato da Meta, repassado pela
 * HubMessage (a doc deles só exemplifica `URL`).
 */
export type HubMessageTemplateButton =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example?: string[] }
  | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
  | { type: 'COPY_CODE'; example: string }

/** Componente cru do template retornado/enviado à API (estrutura varia por tipo). */
export type HubMessageTemplateComponent = {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  text?: string
  /** Só em `BUTTONS`. Na leitura pode trazer tipos fora de `HubMessageTemplateButton`. */
  buttons?: HubMessageTemplateButton[]
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

/**
 * `POST /whatsapp/businesses/{wabaId}/templates`.
 *
 * Cabeçalho de imagem: `{ type: 'HEADER', format: 'IMAGE', example: { header_handle:
 * ['<url https pública>'] } }`. Segundo a doc da Z-API Omni
 * (`https://developer.omni.z-api.io/templates/validation`), `header_handle` aceita
 * o link público, que a Omni converte no identificador da Meta antes de criar, ou o
 * `h` devolvido pela rota de upload (`templates/media`) quando o operador envia o
 * arquivo. FORMATO A CONFIRMAR com um template real nos dois caminhos.
 */
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

/**
 * `POST /whatsapp/businesses/{wabaId}/templates/media` — identificador da Meta para
 * `example.header_handle`. Expira; usar no cadastro logo em seguida.
 */
export type UploadTemplateMediaResponse = {
  h: string
}

/** `POST /whatsapp/businesses/{wabaId}/templates/sync`. */
export type SyncTemplatesResponse = {
  data: HubMessageTemplate[]
  syncedCount?: number
  synced?: boolean
}
