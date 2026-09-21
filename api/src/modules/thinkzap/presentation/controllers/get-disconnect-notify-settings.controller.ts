import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ThinkzapConnectionNotifyRecipientsService } from '../../application/thinkzap-connection-notify-recipients.service'
import { PrismaConnectionNotifyRecipientRepository } from '../../infra/persistence/repositories/prisma-connection-notify-recipient.repository'

export class GetDisconnectNotifySettingsController extends Controller {
  async perform(req: Request): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const service = new ThinkzapConnectionNotifyRecipientsService(
      new PrismaConnectionNotifyRecipientRepository(),
      appId,
    )
    return this.ok({ userIds: await service.get() })
  }
}
