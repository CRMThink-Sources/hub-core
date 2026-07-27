import { env } from '@/config/env'
import { IBX24MessageUpdateEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { appIdResolver } from '@/modules/auth/presentation/controllers/helpers/app-id-resolver'
import { PrismaBitrixWebhookContextRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bitrix-webhook-context.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')
const messageRepo = new PrismaThinkzapMessageRepository()

export async function processBitrixMessageUpdate(
  event: IBX24MessageUpdateEvent,
): Promise<void> {
  log.info(
    { domain: event.auth.domain, line: event.data.LINE },
    'Processing Bitrix message update event',
  )

  if (!event.data.MESSAGES.length) {
    log.warn(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix update event received with no messages — skipping',
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
      'Bitrix webhook context not found for message update',
    )
    return
  }

  const message = event.data.MESSAGES[0]!
  const bitrixMessageId = message.im.message_id
  const newText = message.message.text

  const record = await messageRepo.findByBitrixMessageId(
    context.instance.id,
    bitrixMessageId,
  )

  if (!record || !record.providerMessageId) {
    log.warn(
      {
        instanceId: context.instance.id,
        bitrixMessageId,
        updateLookupFailed: true,
      },
      'z_api_message_id not found for bitrix message update — skipping',
    )
    return
  }

  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  try {
    await zApiClient.editMessage(
      context.instance.instanceId,
      context.instance.zApiToken || '',
      record.chatId || '',
      record.providerMessageId,
      newText,
    )
    log.info(
      {
        instanceId: context.instance.id,
        bitrixMessageId,
        zApiMessageId: record.providerMessageId,
        messageUpdated: true,
      },
      'Message updated via Z-API',
    )
  } catch (error) {
    log.warn(
      {
        instanceId: context.instance.id,
        bitrixMessageId,
        zApiMessageId: record.providerMessageId,
        zApiUpdateFailed: true,
        error,
      },
      'Z-API edit message failed — best-effort, skipping',
    )
  }
}
