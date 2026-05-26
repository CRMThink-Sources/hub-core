import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { RemoveAllowedDepartmentRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/remove-allowed-department.repository'

export class RemoveAllowedDepartmentController extends Controller {
  constructor(
    private readonly removeAllowedDepartment: RemoveAllowedDepartmentRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const bitrixDepartmentId = req.params.bitrixDepartmentId as string
    await this.removeAllowedDepartment.removeDepartment(
      appId,
      bitrixDepartmentId,
    )
    return this.ok({})
  }
}
