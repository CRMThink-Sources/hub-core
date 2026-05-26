import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { z } from 'zod'
import { RemoveAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/remove-allowed-user.repository'

export class RemoveAllowedUserController extends Controller {
  constructor(private readonly removeAllowedUser: RemoveAllowedUserRepository) {
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
      })
      .safeParse(req.params)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    await this.removeAllowedUser.remove(appId, parsed.data.bitrixUserId)
    return this.ok({ removed: true })
  }
}
