import { env } from '@/config/env'
import { IBX24MessageUpdateEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { resolveByMarketplaceCode } from '@/shared/app-catalog/app-catalog'
import { makeBitrixWebhookContextRepository } from '@/modules/thinkzap/main/make-bitrix-webhook-context-repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { prepareOpenLineOutboundText } from '@/modules/thinkzap/application/prepare-open-line-outbound-text'
import { resolveSettingsByInstanceId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixGetUserDisplayNameAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-get-user-display-name.adapter'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'

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

  const bitrixWebhookContextRepo = makeBitrixWebhookContextRepository()
  const appCode =
    resolveByMarketplaceCode(env.appCodes.thinkzap)?.appCodeId ?? ''
  const context = await bitrixWebhookContextRepo.getContext({
    domainName: event.auth.domain,
    appCode,
    line: event.data.LINE,
  })

  if (!context) {
    log.error(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix webhook context not found for message update',
    )
    return
  }

  /**
   * A API oficial (HubMessage) não edita nem apaga mensagem já enviada, e a linha
   * não tem instância Z-API para chamar. Encerra sem erro: o evento chegou, não há
   * o que propagar.
   */
  if (context.connector.provider === ConnectorProvider.HUBMESSAGE) {
    log.info(
      { domain: event.auth.domain, line: event.data.LINE },
      'Linha oficial não propaga edição de mensagem — evento ignorado',
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

  /**
   * A edição substitui o texto inteiro no WhatsApp: sem reaplicar o prefixo do envio,
   * o nome do operador some. Só em row `BITRIX` — mensagem espelhada do aparelho saiu
   * sem prefixo. O nome é o do autor gravado no envio.
   */
  const text =
    record.source === 'BITRIX'
      ? await prepareOpenLineOutboundText({
          text: newText,
          settings: await resolveSettingsByInstanceId(
            {
              instanceId: context.instance.instanceId,
              domainId: context.id,
              appCode,
            },
            makeGetAplicationContext(),
          ),
          operatorUserId: record.bitrixUserId ?? '',
          appId: context.app.id,
          getBitrixUserDisplayName: new BitrixGetUserDisplayNameAdapter(
            new BitrixClient({
              bitrixCredential: context.app.credential,
              domain: context.name,
            }),
          ),
          getAllowedUser: new PrismaAllowedUserRepository(),
        })
      : newText

  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  try {
    await zApiClient.editMessage(
      context.instance.instanceId,
      context.instance.zApiToken || '',
      record.chatId || '',
      record.providerMessageId,
      text,
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
