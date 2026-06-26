/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { httpResponse } from '@/shared/helpers/http'
import type { EventRegistry } from '@/shared/infra/handlers/event-registry'
import type { ZApiEventHandler } from '@/shared/infra/handlers/z-api-event-handler'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'

export class ZApiWebhookHandlerController extends Controller {
  constructor(
    private readonly zApiEventRegistry: EventRegistry<ZApiEventHandler>,
  ) {
    super()
  }
  async perform(req: Request, res: Response): Promise<httpResponse> {
    const headers = req.headers
    const data = req.body

    const params = z
      .object({
        type: z.string(),
      })
      .safeParse(data)
    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }
    const { type } = params.data
    console.log(type)
    const handler = this.zApiEventRegistry.get(type)

    if (!handler) {
      return this.notFound(new Error('Handler not found'))
    }
    await handler.handle(data as ReceivedMessageEvent)

    return this.ok({ message: 'Webhook received' })
  }
}
