import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ThinkzapConnectionNotifyRecipientsService } from '../../application/thinkzap-connection-notify-recipients.service'
import { PrismaConnectionNotifyRecipientRepository } from '../../infra/persistence/repositories/prisma-connection-notify-recipient.repository'

const bodySchema = z.object({
  userIds: z.array(z.number().int()),
})

export class UpdateDisconnectNotifySettingsController extends Controller {
  async perform(req: Request): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(new Error('userIds deve ser um array de inteiros'))
    }

    const service = new ThinkzapConnectionNotifyRecipientsService(
      new PrismaConnectionNotifyRecipientRepository(),
      appId,
    )
    const userIds = await service.set(parsed.data.userIds)
    return this.ok({ userIds })
  }
}
