import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { CreatePortalUser } from '../../application/create-portal-user'
import { PortalUserAlreadyExistsError } from '../../domain/errors/portal-auth.errors'

export class CreatePortalUserController extends Controller {
  constructor(private readonly createPortalUser: CreatePortalUser) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().min(8),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.createPortalUser.execute(parsed.data)
      return { status: 201, result }
    } catch (error) {
      if (error instanceof PortalUserAlreadyExistsError) {
        return {
          status: 409,
          result: { error: 'E-mail já cadastrado' },
        }
      }

      throw error
    }
  }
}
