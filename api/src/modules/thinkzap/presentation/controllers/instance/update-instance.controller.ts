import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { UpdateInstanceSettingsUseCase } from '@/modules/thinkzap/application/update-instance-settings.use-case'
import z from 'zod'
export class UpdateInstanceController extends Controller {
  constructor(
    private readonly updateInstanceSettings: UpdateInstanceSettingsUseCase,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const { id } = req.params
    const params = z
      .object({
        name: z.string().min(1).optional(),
        settings: z
          .object({
            prefixOperatorNameEnabled: z.boolean().optional(),
          })
          .optional(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(new Error(params.error.message))
    }

    if (params.data.name === undefined && params.data.settings === undefined) {
      return this.badRequest(
        new Error('At least one of name or settings must be provided'),
      )
    }

    try {
      const result = await this.updateInstanceSettings.execute({
        connectorId: id as string,
        name: params.data.name,
        settings: params.data.settings,
      })

      return this.ok(result)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update instance'

      if (
        message === 'Connector not found' ||
        message === 'Instance not found' ||
        message === 'Domain not found'
      ) {
        return this.notFound(new Error(message))
      }

      return this.badRequest(new Error(message))
    }
  }
}
