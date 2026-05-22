import { LeaveGroupService } from '@/modules/thinkzap/application/leave-group.service'
import { getGroupIdParam } from '@/modules/thinkzap/presentation/helpers/get-group-id-param'
import { mapGroupServiceError } from '@/modules/thinkzap/presentation/helpers/handle-group-service-error'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

export class LeaveGroupController extends Controller {
  constructor(private readonly leaveGroupService: LeaveGroupService) {
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
      })
      .safeParse(req.query.connectorId ? req.query : req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.leaveGroupService.execute({
        connectorId: parsed.data.connectorId,
        groupId,
      })
      return this.ok(result)
    } catch (error) {
      return mapGroupServiceError(error, 'Failed to leave group')
    }
  }
}
