import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { UpdatePortalUserBitrixId } from '../../application/update-portal-user-bitrix-id'
import { PortalUserNotFoundError } from '../../domain/errors/portal-auth.errors'

/** Maior valor que cabe na coluna INTEGER; acima disso o banco recusaria com 500. */
const MAX_INT = 2_147_483_647

export class UpdatePortalUserBitrixIdController extends Controller {
  constructor(
    private readonly updatePortalUserBitrixId: UpdatePortalUserBitrixId,
  ) {
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
        bitrixUserId: z.number().int().positive().max(MAX_INT).nullable(),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.updatePortalUserBitrixId.execute({
        id: parsedParams.data.id,
        bitrixUserId: parsed.data.bitrixUserId,
      })
      return this.ok(result)
    } catch (error) {
      if (error instanceof PortalUserNotFoundError) {
        return { status: 404, result: { error: 'Usuário não encontrado' } }
      }
      throw error
    }
  }
}
