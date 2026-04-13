import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { GetOrCreateDomain } from '@/shared/application/get-or-create-domain'
import { GenerateTokenRepository } from '@/shared/data/contracts/generate-token'
import z from 'zod'

export class LoginController extends Controller {
  constructor(
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getOrCreateDomain: GetOrCreateDomain,
    private readonly generateToken: GenerateTokenRepository,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = z
      .object({
        domain: z.string(),
        app_code: z.string(),
        member_id: z.string(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { domain, app_code, member_id } = params.data

    const availableApp = await this.getAvailableAppRepository.getById(app_code)

    if (!availableApp) {
      return this.notFound(new Error('Available app not found'))
    }

    const domainEntity = await this.getOrCreateDomain.execute({
      name: domain,
      memberId: member_id,
    })

    const { token } = this.generateToken.generateToken({
      domainId: domainEntity.id,
      appCodeId: availableApp.id,
    })

    return {
      result: {
        token,
      },
      status: 201,
    }
  }
}
