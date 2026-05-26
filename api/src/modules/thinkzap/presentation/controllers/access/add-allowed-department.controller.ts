import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { AddAllowedDepartmentRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/add-allowed-department.repository'
import { ExistsAllowedDepartmentRepository } from '@/modules/thinkzap/domain/repositories/allowed-department/exists-allowed-department.repository'
import { thinkzapUserPermissionsSchema } from '@/modules/thinkzap/domain/thinkzap-permissions'

export class AddAllowedDepartmentController extends Controller {
  constructor(
    private readonly addAllowedDepartment: AddAllowedDepartmentRepository,
    private readonly existsAllowedDepartment: ExistsAllowedDepartmentRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const parsed = z
      .object({
        bitrixDepartmentId: z.string().min(1),
        displayName: z.string().optional().nullable(),
        permissions: thinkzapUserPermissionsSchema.optional(),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const { bitrixDepartmentId, displayName, permissions } = parsed.data

    const alreadyExists = await this.existsAllowedDepartment.existsDepartment(
      appId,
      bitrixDepartmentId,
    )
    if (alreadyExists) {
      return this.badRequest(new Error('Department already on allowlist'))
    }

    const department = await this.addAllowedDepartment.addDepartment({
      appId,
      bitrixDepartmentId,
      displayName: displayName ?? null,
      permissions,
    })

    return this.ok({ department })
  }
}
