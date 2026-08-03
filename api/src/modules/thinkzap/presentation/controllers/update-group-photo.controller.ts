import { UpdateGroupPhotoService } from '@/modules/thinkzap/application/update-group-photo.service'
import { getGroupIdParam } from '@/modules/thinkzap/presentation/helpers/get-group-id-param'
import { mapGroupServiceError } from '@/modules/thinkzap/presentation/helpers/handle-group-service-error'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { parseLineRequest } from './line/line-request'
import z from 'zod'

export class UpdateGroupPhotoController extends Controller {
  constructor(
    private readonly updateGroupPhotoService: UpdateGroupPhotoService,
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
        groupPhoto: z.string().min(1),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.updateGroupPhotoService.execute({
        ...parseLineRequest(req),
        groupId,
        groupPhoto: parsed.data.groupPhoto,
      })
      return this.ok(result)
    } catch (error) {
      return mapGroupServiceError(error, 'Failed to update group photo')
    }
  }
}
