import { CreateGroupService } from '@/modules/thinkzap/application/create-group.service'
import { mapGroupServiceError } from '@/modules/thinkzap/presentation/helpers/handle-group-service-error'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { parseLineRequest } from './line/line-request'
import z from 'zod'

export class CreateGroupController extends Controller {
  constructor(private readonly createGroupService: CreateGroupService) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        groupName: z.string().trim().min(1),
        autoInvite: z.boolean(),
        phones: z.array(z.string().min(1)).min(1),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.createGroupService.execute({
        ...parseLineRequest(req),
        ...parsed.data,
      })
      return this.ok(result)
    } catch (error) {
      return mapGroupServiceError(error, 'Failed to create group')
    }
  }
}
