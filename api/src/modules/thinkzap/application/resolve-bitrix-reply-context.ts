import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'

const log = createWorkerSourceLogger('bitrix')

export async function resolveBitrixReplyContext(
  instanceId: string,
  replyId: string | undefined,
  messageRepo: PrismaThinkzapMessageRepository,
): Promise<string | undefined> {
  if (!replyId) return undefined

  try {
    const record = await messageRepo.findByBitrixMessageId(instanceId, replyId)

    if (!record?.zApiMessageId) {
      log.warn(
        {
          instanceId,
          replyId,
          replyResolutionFailed: true,
          reason: record ? 'noZApiMessageId' : 'notFound',
        },
        'Reply message not found in DB — sending without reply context',
      )
      return undefined
    }

    return record.zApiMessageId
  } catch (err) {
    log.warn(
      { instanceId, replyId, err, replyResolutionFailed: true },
      'DB error resolving reply context — sending without reply context',
    )
    return undefined
  }
}
