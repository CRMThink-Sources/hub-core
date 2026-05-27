import { SendWidgetMessageUseCase } from '@/modules/thinkzap/application/send-widget-message.use-case'
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
        connectorId: z.string().min(1),
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
      const result = await this.sendWidgetMessage.execute(parsed.data)
      return this.ok(result)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send message'

      if (
        message === 'Connector not found' ||
        message === 'Instance not found'
      ) {
        return this.notFound(new Error(message))
      }

      return this.badRequest(new Error(message))
    }
  }
}
