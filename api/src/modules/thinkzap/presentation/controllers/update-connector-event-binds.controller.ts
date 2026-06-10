import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { UpdateConnectorEventBindsUseCase } from '@/modules/thinkzap/application/update-connector-event-binds.use-case'

const bodySchema = z.object({
  messageUpdateEventEnabled: z.boolean().optional(),
  messageDeleteEventEnabled: z.boolean().optional(),
})

export class UpdateConnectorEventBindsController extends Controller {
  constructor(private readonly useCase: UpdateConnectorEventBindsUseCase) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const connectorId = req.params['connectorId']
    if (typeof connectorId !== 'string') {
      return this.badRequest(new Error('connectorId is required'))
    }

    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(new Error(parsed.error.message))
    }

    if (
      parsed.data.messageUpdateEventEnabled === undefined &&
      parsed.data.messageDeleteEventEnabled === undefined
    ) {
      return this.badRequest(
        new Error('At least one event flag must be provided'),
      )
    }

    try {
      await this.useCase.execute({
        connectorId,
        messageUpdateEventEnabled: parsed.data.messageUpdateEventEnabled,
        messageDeleteEventEnabled: parsed.data.messageDeleteEventEnabled,
      })

      return this.ok({ message: 'Event binds updated' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update event binds'

      if (
        message === 'Connector not found' ||
        message === 'Instance not found'
      ) {
        return this.notFound(new Error(message))
      }

      throw error
    }
  }
}
