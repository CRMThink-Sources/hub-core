import { Request, Response } from 'express'
import { DepartmentsUnavailableError } from '@/modules/thinkzap/domain/errors/departments-unavailable.error'
import type { DepartmentDirectory } from '@/modules/thinkzap/domain/ports/department-directory.port'
import { httpResponse } from '@/shared/helpers/http'
import { apiLogger } from '@/shared/infra/logger'
import { Controller } from '@/shared/presentation/controller'

/**
 * Departamentos do portal para a tela de grupos de acesso. Pelo servidor, com a mesma
 * lista que decide o acesso, e não por `BX24.callMethod` no browser.
 */
export class ListPortalDepartmentsController extends Controller {
  constructor(private readonly directory: DepartmentDirectory) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) return this.badRequest(new Error('App context not found'))

    try {
      return this.ok({ departments: await this.directory.list(appId) })
    } catch (error) {
      apiLogger.warn(
        { appId, err: error instanceof Error ? error.message : String(error) },
        'Departamentos do portal indisponíveis',
      )
      return {
        status: 503,
        result: { error: new DepartmentsUnavailableError().message },
      }
    }
  }
}
