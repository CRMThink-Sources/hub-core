import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { SendNotification } from '@/shared/data/contracts/send-notification'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { EnqueueInteractiveButtonSendService } from '@/modules/thinkzap/application/enqueue-interactive-button-send.service'
import { BitrixButtonRobotWebhookHandlerController } from './bitrix-button-robot-webhook-handler.controller'

/**
 * `POST /api/thinkzap/webhooks/bitrix/button-robot-unofficial` — o disparo do
 * robô de botão da linha **não oficial** (Z-API). Recusa qualquer linha que
 * não seja `ZAPI` — ver `BitrixButtonRobotWebhookHandlerController`.
 */
export class BitrixButtonRobotUnofficialWebhookHandlerController extends BitrixButtonRobotWebhookHandlerController {
  constructor(
    getDomain: GetDomainRepository,
    getApp: GetInstalledAppRepository,
    enqueueButtonSend: EnqueueInteractiveButtonSendService,
    sendNotification: SendNotification,
    bitrix: BitrixClient,
    locales: InstallationLocaleRepository | null = null,
  ) {
    super(
      getDomain,
      getApp,
      enqueueButtonSend,
      sendNotification,
      bitrix,
      ConnectorProvider.ZAPI,
      locales,
    )
  }
}
