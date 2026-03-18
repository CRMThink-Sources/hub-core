import { httpResponse } from '@/shared/helpers/http'
import type { EventRegistry } from '@/shared/infra/handlers/event-registry'
import type { BitrixEventHandler } from '@/shared/infra/handlers/bitrix-event-handler'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'
import { IBX24MessageEvent } from '../../domain/interfaces/bitrix-events.interface'

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
    await handler.handle(params.data as IBX24MessageEvent)

    return this.ok({ message: 'Webhook received' })
  }
}
