import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { AddAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/add-allowed-user.repository'
import { ExistsAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/exists-allowed-user.repository'
import { thinkzapUserPermissionsSchema } from '@/modules/thinkzap/domain/thinkzap-permissions'

export class AddAllowedUserController extends Controller {
  constructor(
    private readonly addAllowedUser: AddAllowedUserRepository,
    private readonly existsAllowedUser: ExistsAllowedUserRepository,
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
        bitrixUserId: z.string().min(1),
        displayName: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        permissions: thinkzapUserPermissionsSchema.optional(),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const { bitrixUserId, displayName, email, permissions } = parsed.data

    const alreadyExists = await this.existsAllowedUser.exists(
      appId,
      bitrixUserId,
    )
    if (alreadyExists) {
      return this.badRequest(new Error('User already on allowlist'))
    }

    const user = await this.addAllowedUser.add({
      appId,
      bitrixUserId,
      displayName: displayName ?? null,
      email: email ?? null,
      permissions,
    })

    return this.ok({ user })
  }
}
