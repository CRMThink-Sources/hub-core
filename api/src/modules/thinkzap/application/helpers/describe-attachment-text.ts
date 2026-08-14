import { WidgetAttachmentKind } from '@/modules/thinkzap/application/send-widget-message.types'

/**
 * Texto descritivo do anexo, para quando o envio pelo widget não tem texto nenhum.
 *
 * Existe porque a abertura da conversa no canal aberto **precisa** de um texto:
 * `imconnector.send.messages` posta uma mensagem, não um evento vazio. Antes o
 * chamador passava `message.text as string` com `text` nulo, e o resultado era o
 * literal `"[Mensagem enviada a partir do CRM]\nnull"` no histórico do cliente.
 *
 * Função pura. O tipo do anexo é o do widget (`kind`), não o `type` persistido: é o
 * que o chamador tem em mãos no momento do envio.
 */
const DESCRIPTION_BY_KIND: Record<WidgetAttachmentKind, string> = {
  image: '[Imagem enviada]',
  video: '[Vídeo enviado]',
  audio: '[Áudio enviado]',
  file: '[Arquivo enviado]',
}

export function describeAttachmentText(kind: WidgetAttachmentKind): string {
  return DESCRIPTION_BY_KIND[kind]
}

/**
 * O texto a postar no canal aberto para um envio: o do operador quando existe,
 * senão o descritivo do **primeiro** anexo.
 *
 * Primeiro anexo e não todos: uma postagem por mídia dobraria o prefixo
 * `[Mensagem enviada a partir do CRM]` no histórico do cliente. `null` quando não há
 * nem texto nem anexo — caso que o envio já recusa antes, e que aqui só significa
 * "não há o que postar".
 */
export function resolveOpenChannelText(
  message: string | undefined,
  attachmentKinds: readonly WidgetAttachmentKind[],
): string | null {
  const trimmed = message?.trim()
  if (trimmed) return trimmed

  const [first] = attachmentKinds
  return first ? describeAttachmentText(first) : null
}

/**
 * O mesmo descritivo, derivado do `type` **persistido**.
 *
 * Para o reparo pelo callback de status, que só tem a row da mensagem em mãos — o
 * `kind` do anexo original não sobrevive à persistência. `null` quando não há texto
 * nem tipo descritível: nada a postar, e postar vazio abriria uma conversa com uma
 * mensagem em branco no histórico do cliente.
 */
const DESCRIPTION_BY_PERSISTED_TYPE: Record<string, string> = {
  IMAGE: '[Imagem enviada]',
  VIDEO: '[Vídeo enviado]',
  AUDIO: '[Áudio enviado]',
  DOCUMENT: '[Arquivo enviado]',
  STICKER: '[Sticker enviado]',
  CONTACT: '[Contato enviado]',
}

export function resolveOpenChannelTextFromPersisted(persisted: {
  text: string | null
  type: string
}): string | null {
  const trimmed = persisted.text?.trim()
  if (trimmed) return trimmed

  return DESCRIPTION_BY_PERSISTED_TYPE[persisted.type] ?? null
}
