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

/**
 * Estado de uma transição de entrega, dentro de `contents[].state`.
 *
 * `@class` vem serializado do Java da HubMessage (`.Failed` na recusa) e `name` é o
 * rótulo (`ERROR`). Os dois são lidos porque nenhum dos dois é documentado: casar por
 * um só deixaria a detecção presa a um detalhe de serialização que ninguém prometeu.
 *
 * `failedDescription` traz o erro **cru da Meta**, incluindo o corpo HTTP — é a única
 * pista de por que a mensagem não saiu, e por isso vai sempre para o log.
 */
export type HubMessageDeliveryState = {
  '@class'?: string
  name?: string
  failedDescription?: string
}

/**
 * Um erro da Cloud API da Meta, como a HubMessage o repassa em
 * `contents[].external_information.errors[]`.
 *
 * `code` é a chave estável: o texto (`title`, `message`, `error_data.details`) é
 * escrito pela Meta, traduzido e reescrito sem aviso, enquanto o número não muda. Por
 * isso a tradução casa por código primeiro e só depois por substring do texto.
 *
 * Tudo opcional porque só o payload de `131047` foi observado, e afirmar campo
 * obrigatório a partir de uma amostra faria um callback ligeiramente diferente
 * quebrar a leitura em vez de degradar.
 */
export type HubMessageDeliveryError = {
  code?: string
  title?: string
  message?: string
  href?: string
  error_data?: {
    details?: string
  }
}

/**
 * Um item de `contents[]` no callback de status: uma transição de estado da mensagem
 * que **nós** enviamos.
 *
 * `identifier` é o id da própria transição — não da mensagem. É o que serve de chave
 * de idempotência: a reentrega do mesmo evento repete o `identifier`, e duas
 * transições distintas da mesma mensagem trazem valores diferentes.
 *
 * `external_information.errors[]` é onde o motivo real chega quando
 * `state.failedDescription` vem `null` — foi assim no callback de janela de 24h
 * fechada (2026-08-30), e ler só o `failedDescription` fez o operador receber
 * "recusou o envio e não informou o motivo" para um erro que a Meta explicou.
 */
export type HubMessageStateItem = {
  identifier?: string
  moment?: number
  phone?: string
  /** `ErrorCallback` na recusa; outros valores não observados. */
  type?: string
  internal_information?: {
    /** Repete o `message._id` — a confirmação de que ele é o id do envio. */
    integration_id?: string
  }
  external_information?: {
    errors?: HubMessageDeliveryError[]
  }
  state?: HubMessageDeliveryState
}

/**
 * Corpo do callback de status (`MESSAGE_DELIVERY`).
 *
 * **Não é o mesmo envelope da mensagem recebida**: não vem `messageEventType` nem
 * `sender`, e é por isso que `isHubMessageWebhookEnvelope` rejeita este payload como
 * "inesperado" — descarte silencioso com `200`, que é o que escondia a recusa da Meta.
 *
 * `message._id` é o `messageId` devolvido pelo `POST /messages`, ou seja, o
 * `providerMessageId` que o envio persistiu. É essa igualdade que permite correlacionar
 * o status com a mensagem do canal aberto sem coluna nova.
 */
export type HubMessageStatusEnvelope = {
  message: {
    _id: string
    channel_id: string
    tenant?: string
    tenant_owner?: string
    created_by?: string
    created?: number
    recipient?: HubMessageParty
    contents: HubMessageStateItem[]
    media_webhook_processed?: boolean
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Reconhece o callback de status pela **forma do corpo**, porque a HubMessage entrega
 * os dois eventos na mesma URL e não manda header nem campo de tipo que sirva.
 *
 * Exige o mínimo que o processamento usa — canal, id da mensagem e ao menos um estado
 * — e nada além disso: só o payload de recusa foi observado, então um estado de
 * sucesso com campos diferentes precisa passar por aqui e virar log, em vez de cair no
 * warn de "payload inesperado".
 */
export function isHubMessageStatusEnvelope(
  body: unknown,
): body is HubMessageStatusEnvelope {
  if (typeof body !== 'object' || body === null) return false

  const { message } = body as { message?: unknown }
  if (typeof message !== 'object' || message === null) return false

  const { _id, channel_id, contents } = message as {
    _id?: unknown
    channel_id?: unknown
    contents?: unknown
  }

  if (!isNonEmptyString(_id) || !isNonEmptyString(channel_id)) return false
  if (!Array.isArray(contents)) return false

  return contents.some(item => {
    if (typeof item !== 'object' || item === null) return false
    const { state } = item as { state?: unknown }
    if (typeof state !== 'object' || state === null) return false
    return isNonEmptyString((state as { name?: unknown }).name)
  })
}

/**
 * Distingue recusa de qualquer outro estado.
 *
 * Casa por `name === 'ERROR'` **ou** `@class === '.Failed'`: os dois vêm juntos no
 * payload observado, e aceitar qualquer um dos dois é o que evita voltar aqui se a
 * HubMessage mexer na serialização.
 *
 * Só o estado de erro produz mensagem no canal aberto. Sucesso viraria aviso em todo
 * envio — ruído no chat do cliente.
 */
export function isDeliveryFailureState(
  state: HubMessageDeliveryState | undefined,
): boolean {
  if (!state) return false
  return state.name === 'ERROR' || state['@class'] === '.Failed'
}

/**
 * A transição que interessa dentro de `contents[]`: a de erro, se houver; a primeira
 * com estado, caso contrário.
 *
 * O array é plural e nada garante uma entrada só. Pegar `contents[0]` cegamente
 * deixaria uma recusa passar em silêncio se ela viesse depois de um estado neutro.
 */
export function findStatusStateItem(
  envelope: HubMessageStatusEnvelope,
): HubMessageStateItem | undefined {
  const withState = envelope.message.contents.filter(item => item?.state)
  return (
    withState.find(item => isDeliveryFailureState(item.state)) ?? withState[0]
  )
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
