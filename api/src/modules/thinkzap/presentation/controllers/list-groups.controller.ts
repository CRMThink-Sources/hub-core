import { ListGroupsService } from '@/modules/thinkzap/application/list-groups.service'
import { mapGroupServiceError } from '@/modules/thinkzap/presentation/helpers/handle-group-service-error'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { parseLineRequest } from './line/line-request'
import z from 'zod'

export class ListGroupsController extends Controller {
  constructor(private readonly listGroupsService: ListGroupsService) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      })
      .safeParse(req.query)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.listGroupsService.execute({
        ...parseLineRequest(req),
        ...parsed.data,
      })
      return this.ok(result)
    } catch (error) {
      return mapGroupServiceError(error, 'Failed to list groups')
    }
  }
}
