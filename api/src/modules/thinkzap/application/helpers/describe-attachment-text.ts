import { WidgetAttachmentKind } from '@/modules/thinkzap/application/send-widget-message.types'
import {
  DEFAULT_NOTICE_LOCALE,
  type NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import { historyNotices } from '@/modules/thinkzap/domain/notices/history-notices'

/**
 * Texto descritivo do anexo, para quando o envio pelo widget não tem texto nenhum.
 *
 * Existe porque a abertura da conversa no canal aberto **precisa** de um texto:
 * `imconnector.send.messages` posta uma mensagem, não um evento vazio. Antes o
 * chamador passava `message.text as string` com `text` nulo, e o resultado era o
 * literal `"[Mensagem enviada a partir do CRM]\nnull"` no histórico do cliente.
 *
 * Função pura. O tipo do anexo é o do widget (`kind`), não o `type` persistido: é o
 * que o chamador tem em mãos no momento do envio. O texto sai no idioma da instalação
 * (`domain/notices/history-notices.ts`).
 */
export function describeAttachmentText(
  kind: WidgetAttachmentKind,
  locale: NoticeLocale = DEFAULT_NOTICE_LOCALE,
): string {
  return historyNotices(locale).attachment[kind]
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
  locale: NoticeLocale = DEFAULT_NOTICE_LOCALE,
): string | null {
  const trimmed = message?.trim()
  if (trimmed) return trimmed

  const [first] = attachmentKinds
  return first ? describeAttachmentText(first, locale) : null
}
