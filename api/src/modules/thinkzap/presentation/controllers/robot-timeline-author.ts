import type { NoticeLocale } from '@/modules/thinkzap/domain/notices/notice-locale'
import { timelineNotices } from '@/modules/thinkzap/domain/notices/timeline-notices'

/** O que o comentário de timeline precisa para sair em nome de quem rodou o robô. */
export type RobotTimelineAuthor = {
  authorBitrixUserId?: string
  senderLine?: (name: string) => string
}

/**
 * Autor do comentário de um robô do Bizproc: o usuário que veio em `auth.user_id`.
 *
 * Sem usuário útil (vazio, `0`), não há autor e o comentário sai com a credencial da
 * instalação, como sempre foi. Se o usuário existir mas nunca tiver autorizado o app, o
 * serviço de notificação faz o mesmo e nomeia o remetente no texto.
 */
export function robotTimelineAuthor(
  userId: string | number | undefined,
  locale: NoticeLocale,
): RobotTimelineAuthor {
  const id = userId === undefined ? '' : String(userId).trim()
  if (!id || id === '0') return {}

  return { authorBitrixUserId: id, senderLine: timelineNotices(locale).sentBy }
}
