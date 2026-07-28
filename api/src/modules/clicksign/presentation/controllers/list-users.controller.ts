import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { BitrixUserService } from '@/shared/application/bitrix-user.service'
import { clicksignError } from '../../errors/catalog'

export class ListUsersController extends Controller {
  constructor(private readonly users: BitrixUserService) {
    super()
  }

  async perform(_req: Request): Promise<httpResponse> {
    try {
      const users = await this.users.listActiveUsers()
      return this.ok({ users })
    } catch (error) {
      if (error instanceof BitrixError)
        throw clicksignError('clicksign.users.bitrix_error', error)
      throw error
    }
  }
}
