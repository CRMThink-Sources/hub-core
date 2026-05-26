import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { UpdateAllowedUserPermissionsRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/update-allowed-user-permissions.repository'
import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'
import { thinkzapUserPermissionsSchema } from '@/modules/thinkzap/domain/thinkzap-permissions'

export class UpdateAllowedUserPermissionsController extends Controller {
  constructor(
    private readonly updatePermissions: UpdateAllowedUserPermissionsRepository,
    private readonly getAllowedUser: GetAllowedUserRepository,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const paramsParsed = z
      .object({ bitrixUserId: z.string().min(1) })
      .safeParse(req.params)

    const bodyParsed = z
      .object({ permissions: thinkzapUserPermissionsSchema })
      .safeParse(req.body)

    if (!paramsParsed.success || !bodyParsed.success) {
      return this.badRequest(new Error('Invalid request'))
    }

    const { bitrixUserId } = paramsParsed.data
    const existing = await this.getAllowedUser.getByAppIdAndBitrixUserId(
      appId,
      bitrixUserId,
    )
    if (!existing) {
      return this.notFound(new Error('User not found'))
    }

    await this.updatePermissions.updatePermissions(
      appId,
      bitrixUserId,
      bodyParsed.data.permissions,
    )

    const user = await this.getAllowedUser.getByAppIdAndBitrixUserId(
      appId,
      bitrixUserId,
    )

    return this.ok({ user })
  }
}
