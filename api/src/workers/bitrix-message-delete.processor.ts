import { env } from '@/config/env'
import { IBX24MessageDeleteEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { appIdResolver } from '@/modules/auth/presentation/controllers/helpers/app-id-resolver'
import { PrismaBitrixWebhookContextRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bitrix-webhook-context.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')
const messageRepo = new PrismaThinkzapMessageRepository()

export async function processBitrixMessageDelete(
  event: IBX24MessageDeleteEvent,
): Promise<void> {
  log.info(
    { domain: event.auth.domain, line: event.data.LINE },
    'Processing Bitrix message delete event',
  )

  if (!event.data.MESSAGES.length) {
    log.warn(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix delete event received with no messages — skipping',
    )
    return
  }

  const bitrixWebhookContextRepo = new PrismaBitrixWebhookContextRepository()
  const context = await bitrixWebhookContextRepo.getContext({
    domainName: event.auth.domain,
    appCode: appIdResolver[env.appCodes.thinkzap] || '',
    line: event.data.LINE,
  })

  if (!context) {
    log.error(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix webhook context not found for message delete',
    )
    return
  }

  const message = event.data.MESSAGES[0]
  const bitrixMessageId = message.im.message_id

  const record = await messageRepo.findByBitrixMessageId(
    context.instance.id,
    bitrixMessageId,
  )

  if (!record || !record.zApiMessageId) {
    log.warn(
      {
        instanceId: context.instance.id,
        bitrixMessageId,
        deleteLookupFailed: true,
      },
      'z_api_message_id not found for bitrix message delete — skipping',
    )
    return
  }

  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  try {
    await zApiClient.deleteMessage(
      context.instance.instanceId,
      context.instance.zApiToken || '',
      record.chatId || '',
      record.zApiMessageId,
    )
    log.info(
      {
        instanceId: context.instance.id,
        bitrixMessageId,
        zApiMessageId: record.zApiMessageId,
        messageDeleted: true,
      },
      'Message deleted via Z-API',
    )
  } catch (error) {
    log.warn(
      {
        instanceId: context.instance.id,
        bitrixMessageId,
        zApiMessageId: record.zApiMessageId,
        zApiDeleteFailed: true,
        error,
      },
      'Z-API delete message failed — best-effort, skipping',
    )
  }
}
