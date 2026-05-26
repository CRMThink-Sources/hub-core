import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { UpdateAllowedDepartmentPermissionsRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/update-allowed-department-permissions.repository'
import { thinkzapUserPermissionsSchema } from '@/modules/thinkzap/domain/thinkzap-permissions'

export class UpdateAllowedDepartmentPermissionsController extends Controller {
  constructor(
    private readonly updateAllowedDepartmentPermissions: UpdateAllowedDepartmentPermissionsRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const bitrixDepartmentId = req.params.bitrixDepartmentId as string

    const parsed = z
      .object({ permissions: thinkzapUserPermissionsSchema })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    await this.updateAllowedDepartmentPermissions.updateDepartmentPermissions(
      appId,
      bitrixDepartmentId,
      parsed.data.permissions,
    )

    return this.ok({})
  }
}
