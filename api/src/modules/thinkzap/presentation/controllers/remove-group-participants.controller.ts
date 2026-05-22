import { RemoveGroupParticipantsService } from '@/modules/thinkzap/application/remove-group-participants.service'
import { getGroupIdParam } from '@/modules/thinkzap/presentation/helpers/get-group-id-param'
import { mapGroupServiceError } from '@/modules/thinkzap/presentation/helpers/handle-group-service-error'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

export class RemoveGroupParticipantsController extends Controller {
  constructor(
    private readonly removeGroupParticipantsService: RemoveGroupParticipantsService,
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
        phones: z.array(z.string().min(1)).min(1),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.removeGroupParticipantsService.execute({
        ...parsed.data,
        groupId,
      })
      return this.ok(result)
    } catch (error) {
      return mapGroupServiceError(error, 'Failed to remove group participants')
    }
  }
}
