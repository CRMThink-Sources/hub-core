import { UpdateGroupDescriptionService } from '@/modules/thinkzap/application/update-group-description.service'
import { getGroupIdParam } from '@/modules/thinkzap/presentation/helpers/get-group-id-param'
import { mapGroupServiceError } from '@/modules/thinkzap/presentation/helpers/handle-group-service-error'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

export class UpdateGroupDescriptionController extends Controller {
  constructor(
    private readonly updateGroupDescriptionService: UpdateGroupDescriptionService,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const groupId = getGroupIdParam(req)
    if (!groupId) {
      return this.badRequest(new Error('groupId is required'))
    }

    const parsed = z
      .object({
        connectorId: z.string().min(1),
        groupDescription: z.string(),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.updateGroupDescriptionService.execute({
        connectorId: parsed.data.connectorId,
        groupId,
        groupDescription: parsed.data.groupDescription,
      })
      return this.ok(result)
    } catch (error) {
      return mapGroupServiceError(error, 'Failed to update group description')
    }
  }
}
