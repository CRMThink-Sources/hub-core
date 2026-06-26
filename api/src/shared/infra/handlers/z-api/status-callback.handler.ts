import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ZApiEventHandler } from '../z-api-event-handler'
import { StatusCallbackEvent } from './z-api'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { PrismaDomainRepository } from '../../persistence/repositories/prisma-domain.repository'
import { env } from '@/config/env'
import { apiLogger } from '@/shared/infra/logger'
import { ResolveOperatorBitrixAccessToken } from '@/modules/thinkzap/application/resolve-operator-bitrix-access-token'
import { PrismaThinkzapOperatorOAuthRepository } from '@/modules/thinkzap/infra/persistence/prisma-thinkzap-operator-oauth.repository'
import { PrismaAvailableAppRepository } from '../../persistence/repositories/prisma-available-app.repository'
import { PrismaInstalledAppRepository } from '../../persistence/repositories/prisma-installed-app.repository'
import { PrismaCredentialRepository } from '../../persistence/repositories/prisma-credential.repository'
import { BitrixOAuthClient } from '../../clients/bitrix-oauth.client'
import { BitrixClient } from '../../clients/bitrix.client'

export class StatusCallbackHandler implements ZApiEventHandler {
  eventType = 'MessageStatusCallback'

  async handle(event: StatusCallbackEvent): Promise<void> {
    if (event.status !== 'SENT') return

    const zApiMessageId = event.ids[0]
    if (!zApiMessageId) return

    const instanceRepo = new PrismaInstanceRepository()
    const instance = await instanceRepo.getInstanceByInstanceId(
      event.instanceId,
    )
    if (!instance?.vinculatedChannel) return

    const messageRepo = new PrismaThinkzapMessageRepository()
    const message = await messageRepo.findByZApiMessageId(
      instance.id,
      zApiMessageId,
    )

    if (!message || message.source !== 'BITRIX' || message.chatId !== null)
      return

    const domainRepo = new PrismaDomainRepository()
    const domain = await domainRepo.getDomainById(instance.domainId)
    if (!domain) return

    try {
      const bitrix = await makeBitrixClientByDomainAndAppCoode(
        domain.name,
        'crmthink.thinkzap',
      )

      if (
        instance.settings.widgetOpenChannelEnabled &&
        instance.vinculatedChannel
      ) {
        const { chatId, bitrixMessageId } = await bitrix.sendToOpenChannel(
          instance.vinculatedChannel,
          env.bitrix.connector.code,
          event.phone,
          message.text as string,
        )
      }

      await messageRepo.create({
        instanceId: instance.id,
        source: 'BITRIX',
        zApiMessageId,
        type: message.type,
      })

      apiLogger.info(
        {
          app: 'thinkzap',
          instanceId: event.instanceId,
          zApiMessageId,
          phone: event.phone,
        },
        'Opened Bitrix channel on status callback',
      )
    } catch (err) {
      apiLogger.error(
        { app: 'thinkzap', instanceId: event.instanceId, zApiMessageId, err },
        'Failed to open Bitrix channel on status callback',
      )
    }
  }
}
