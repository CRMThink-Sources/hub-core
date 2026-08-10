import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { logThinkzapError } from '../errors/catalog'

const log = createWorkerSourceLogger('bitrix')

export async function resolveBitrixReplyContext(
  instanceId: string,
  replyId: string | undefined,
  messageRepo: PrismaThinkzapMessageRepository,
): Promise<string | undefined> {
  if (!replyId) return undefined

  try {
    const record = await messageRepo.findByBitrixMessageId(instanceId, replyId)

    if (!record?.providerMessageId) {
      logThinkzapError(
        log,
        'thinkzap.bitrix.reply_context_failed',
        {
          instanceId,
          replyId,
          replyResolutionFailed: true,
          reason: record ? 'noProviderMessageId' : 'notFound',
        },
        {
          level: 'warn',
          msg: 'Reply message not found in DB — sending without reply context',
        },
      )
      return undefined
    }

    return record.providerMessageId
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.bitrix.reply_context_failed',
      { instanceId, replyId, err, replyResolutionFailed: true },
      {
        level: 'warn',
        msg: 'DB error resolving reply context — sending without reply context',
      },
    )
    return undefined
  }
}
