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
