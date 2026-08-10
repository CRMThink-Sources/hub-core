import { SendWidgetMessageUseCase } from '@/modules/thinkzap/application/send-widget-message.use-case'
import { mapWidgetSendError } from '@/modules/thinkzap/presentation/helpers/handle-widget-send-error'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

const attachmentSchema = z.object({
  kind: z.enum(['image', 'video', 'audio', 'file']),
  content: z.string().min(1),
  name: z.string().optional(),
})

export class SendWidgetMessageController extends Controller {
  constructor(private readonly sendWidgetMessage: SendWidgetMessageUseCase) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        subscriptionItemId: z.string().min(1),
        destination: z.string().min(1),
        message: z.string().trim().min(1).optional(),
        attachments: z.array(attachmentSchema).optional(),
        entity: z.string().min(1),
        entityId: z.string().min(1),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.sendWidgetMessage.execute({
        ...parsed.data,
        domainId: (req as unknown as { domainId: string }).domainId,
        appCode: (req as unknown as { appId: string }).appId,
      })
      return this.ok(result)
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_send_failed',
        { app: 'thinkzap', err: error },
        { level: 'error' },
      )
      return mapWidgetSendError(error)
    }
  }
}
