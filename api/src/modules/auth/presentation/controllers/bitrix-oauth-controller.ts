import { env } from '@/config/env'
import { UpsertOperatorBitrixOAuth } from '@/modules/thinkzap/application/upsert-operator-bitrix-oauth'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import type { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import type { Request } from 'express'
import z from 'zod'
import { appIdResolver } from './helpers/app-id-resolver'

export class BitrixOAuthController extends Controller {
  constructor(
    private readonly getDomainRepository: GetDomainRepository,
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getInstalledAppRepository: GetInstalledAppRepository,
    private readonly upsertOperatorOAuth: UpsertOperatorBitrixOAuth,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = z
      .object({
        domain: z.string().min(1),
        app_code: z.string().min(1),
        bitrix_user_id: z.string().min(1),
        access_token: z.string().min(1),
        refresh_token: z.string().min(1),
        expires_in: z.coerce.number().positive(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const {
      domain: rawDomain,
      app_code,
      bitrix_user_id,
      access_token,
      refresh_token,
      expires_in,
    } = params.data

    if (
      app_code !== env.appCodes.thinkzap &&
      appIdResolver[app_code] !== 'crmthink.thinkzap'
    ) {
      return this.badRequest(
        new Error('Operator OAuth is only supported for ThinkZap'),
      )
    }

    const domainName = rawDomain.replace(/^https?:\/\//, '').split('/')[0] ?? ''
    const domainEntity = await this.getDomainRepository.getDomain(domainName)
    if (!domainEntity) {
      return this.notFound(new Error('Domain not found'))
    }

    const resolvedAppId = appIdResolver[app_code] ?? app_code
    const availableApp =
      await this.getAvailableAppRepository.getById(resolvedAppId)
    if (!availableApp) {
      return this.notFound(new Error('ThinkZap app not found'))
    }

    const installedApp =
      await this.getInstalledAppRepository.getByAppCodeAndDomainId(
        availableApp.id,
        domainEntity.id,
      )
    if (!installedApp) {
      return this.notFound(new Error('ThinkZap not installed on this portal'))
    }

    await this.upsertOperatorOAuth.execute({
      appId: installedApp.id,
      bitrixUserId: bitrix_user_id,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    })

    return this.ok({ saved: true })
  }
}
