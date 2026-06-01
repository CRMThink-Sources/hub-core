import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ListPortalUsers } from '../../application/list-portal-users'

export class ListPortalUsersController extends Controller {
  constructor(private readonly listPortalUsers: ListPortalUsers) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(10),
        search: z.string().optional(),
      })
      .safeParse(req.query)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const result = await this.listPortalUsers.execute(parsed.data)
    return this.ok(result)
  }
}
