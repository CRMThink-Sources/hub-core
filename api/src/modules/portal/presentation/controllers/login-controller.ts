import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { LoginPortalUser } from '../../application/login-portal-user'
import {
  InactivePortalUserError,
  InvalidCredentialsError,
} from '../../domain/errors/portal-auth.errors'

export class PortalLoginController extends Controller {
  constructor(private readonly loginPortalUser: LoginPortalUser) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        email: z.string().email(),
        password: z.string().min(1),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.loginPortalUser.execute(parsed.data)
      return this.ok(result)
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return {
          status: 401,
          result: { error: 'Credenciais inválidas' },
        }
      }

      if (error instanceof InactivePortalUserError) {
        return {
          status: 403,
          result: { error: 'Conta inativa' },
        }
      }

      throw error
    }
  }
}
