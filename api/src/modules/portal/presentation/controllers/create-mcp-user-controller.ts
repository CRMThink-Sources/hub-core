import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { CreateMcpUser } from '../../application/create-mcp-user'
import { isStrongPassword } from '../../application/password.service'
import {
  McpDomainNotFoundError,
  McpUserAlreadyExistsError,
} from '../../domain/errors/mcp-user.errors'

export class CreateMcpUserController extends Controller {
  constructor(private readonly createMcpUser: CreateMcpUser) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        email: z.string().email(),
        name: z.string().min(1),
        password: z.string().refine(isStrongPassword, 'weak_password'),
        domainId: z.string().min(1),
        isAdmin: z.boolean().default(false),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.createMcpUser.execute(parsed.data)
      return { status: 201, result }
    } catch (error) {
      if (error instanceof McpUserAlreadyExistsError) {
        return { status: 409, result: { error: 'E-mail já cadastrado' } }
      }
      if (error instanceof McpDomainNotFoundError) {
        return { status: 400, result: { error: 'Domínio não encontrado' } }
      }
      throw error
    }
  }
}
