import { httpResponse } from '@/shared/helpers/http'
import type { EventRegistry } from '@/shared/infra/handlers/event-registry'
import type { BitrixEventHandler } from '@/shared/infra/handlers/bitrix-event-handler'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

export class BitrixWebhookHandlerController extends Controller {
  constructor(
    private readonly bitrixEventRegistry: EventRegistry<BitrixEventHandler>,
  ) {
    super()
  }
  async perform(req: Request, res: Response): Promise<httpResponse> {
    const params = z
      .object({
        event: z.string(),
        data: z.object({
          CONNECTOR: z.string(),
          LINE: z.string(),
          MESSAGES: z.array(
            z.object({
              im: z.object({
                chat_id: z.string(),
                message_id: z.string(),
              }),
              message: z.object({
                user_id: z.string(),
                text: z.string(),
                files: z
                  .array(
                    z.object({
                      name: z.string(),
                      type: z.string(),
                      mime: z.string(),
                      link: z.string(),
                      downloadLink: z.string(),
                      size: z.string(),
                      sizef: z.string(),
                      width: z.number(),
                      height: z.number(),
                    }),
                  )
                  .optional(),
              }),
              chat: z.object({
                id: z.string(),
              }),
            }),
          ),
        }),
        auth: z.object({
          access_token: z.string(),
          expires: z.string(),
          expires_in: z.string(),
          scope: z.string(),
          domain: z.string(),
          server_endpoint: z.string(),
          status: z.string(),
          client_endpoint: z.string(),
          member_id: z.string(),
          user_id: z.string(),
          application_token: z.string(),
        }),
        ts: z.string(),
        event_handler_id: z.string(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { event } = params.data

    const handler = this.bitrixEventRegistry.get(event)
    if (!handler) {
      return this.notFound(new Error('Handler not found'))
    }

    await handler.handle(params.data)

    return this.ok({ message: 'Webhook received' })
  }
}
