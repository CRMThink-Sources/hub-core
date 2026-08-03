import { GetGroupMetadataService } from '@/modules/thinkzap/application/get-group-metadata.service'
import { getGroupIdParam } from '@/modules/thinkzap/presentation/helpers/get-group-id-param'
import { mapGroupServiceError } from '@/modules/thinkzap/presentation/helpers/handle-group-service-error'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { parseLineRequest } from './line/line-request'

export class GetGroupMetadataController extends Controller {
  constructor(
    private readonly getGroupMetadataService: GetGroupMetadataService,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const groupId = getGroupIdParam(req)
    if (!groupId) {
      return this.badRequest(new Error('groupId is required'))
    }

    try {
      const result = await this.getGroupMetadataService.execute({
        ...parseLineRequest(req),
        groupId,
      })
      return this.ok(result)
    } catch (error) {
      return mapGroupServiceError(error, 'Failed to get group metadata')
    }
  }
}
