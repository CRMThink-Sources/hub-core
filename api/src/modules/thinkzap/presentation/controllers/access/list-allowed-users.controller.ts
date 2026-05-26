import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import { ListAllowedUsersRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/list-allowed-users.repository'

export class ListAllowedUsersController extends Controller {
  constructor(private readonly listAllowedUsers: ListAllowedUsersRepository) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.thinkzapInstalledAppId
    if (!appId) {
      return this.badRequest(new Error('App context not found'))
    }

    const users = await this.listAllowedUsers.listByAppId(appId)
    return this.ok({ users })
  }
}
