import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { GetOrCreateDomain } from '@/shared/application/get-or-create-domain'
import { GenerateTokenRepository } from '@/shared/data/contracts/generate-token'
import { resolveBitrixUserAtLogin } from '../../application/resolve-bitrix-user-at-login'
import z from 'zod'
import { appIdResolver } from './helpers/app-id-resolver'

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
        access_token: z.string().min(1),
        bitrix_user_id: z.string().optional(),
        is_bitrix_admin: z.boolean().optional(),
        bitrix_user_name: z.string().optional(),
        bitrix_user_email: z.string().optional(),
        bitrix_department_ids: z.array(z.string()).optional(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const {
      domain,
      app_code,
      member_id,
      access_token,
      bitrix_user_id,
      is_bitrix_admin,
      bitrix_user_name,
      bitrix_user_email,
      bitrix_department_ids,
    } = params.data
    const appId = appIdResolver[app_code]
    if (!appId) {
      return this.notFound(new Error('App ID not found'))
    }
    const availableApp = await this.getAvailableAppRepository.getById(appId)

    if (!availableApp) {
      return this.notFound(new Error('Available app not found'))
    }

    const domainEntity = await this.getOrCreateDomain.execute({
      name: domain,
      memberId: member_id,
    })

    let bitrixUser
    try {
      bitrixUser = await resolveBitrixUserAtLogin({
        domain,
        accessToken: access_token,
        bitrixUserIdFallback: bitrix_user_id,
        bitrixUserNameFallback: bitrix_user_name,
        bitrixUserEmailFallback: bitrix_user_email,
        isBitrixAdminFallback: is_bitrix_admin,
        bitrixDepartmentIdsFallback: bitrix_department_ids,
      })
    } catch (err) {
      return this.badRequest(
        err instanceof Error ? err : new Error('Failed to resolve Bitrix user'),
      )
    }

    const { token } = this.generateToken.generateToken({
      domainId: domainEntity.id,
      appCodeId: availableApp.id,
      bitrixUserId: bitrixUser.bitrixUserId,
      isBitrixAdmin: bitrixUser.isBitrixAdmin,
      bitrixDepartmentIds: bitrixUser.bitrixDepartmentIds,
    })

    return {
      result: {
        token,
      },
      status: 201,
    }
  }
}
