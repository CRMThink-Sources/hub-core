import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { UpdateMcpUser } from '../../application/update-mcp-user'
import { isStrongPassword } from '../../application/password.service'
import {
  McpDomainNotFoundError,
  McpUserNotFoundError,
} from '../../domain/errors/mcp-user.errors'

export class UpdateMcpUserController extends Controller {
  constructor(private readonly updateMcpUser: UpdateMcpUser) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsedParams = z
      .object({ id: z.string().min(1) })
      .safeParse(req.params)

    if (!parsedParams.success) {
      return this.badRequest(new Error('Invalid id'))
    }

    const parsed = z
      .object({
        name: z.string().min(1).optional(),
        domainId: z.string().min(1).optional(),
        isAdmin: z.boolean().optional(),
        isActive: z.boolean().optional(),
        password: z
          .string()
          .refine(isStrongPassword, 'weak_password')
          .optional(),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.updateMcpUser.execute({
        id: parsedParams.data.id,
        ...parsed.data,
      })
      return this.ok(result)
    } catch (error) {
      if (error instanceof McpUserNotFoundError) {
        return { status: 404, result: { error: 'Usuário não encontrado' } }
      }
      if (error instanceof McpDomainNotFoundError) {
        return { status: 400, result: { error: 'Domínio não encontrado' } }
      }
      throw error
    }
  }
}
