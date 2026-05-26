import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { ListAllowedDepartmentsRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/list-allowed-departments.repository'

export class ListAllowedDepartmentsController extends Controller {
  constructor(
    private readonly listAllowedDepartments: ListAllowedDepartmentsRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const departments =
      await this.listAllowedDepartments.listDepartmentsByAppId(appId)
    return this.ok({ departments })
  }
}
