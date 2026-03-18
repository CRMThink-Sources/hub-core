import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAvailableAppRepository } from '@/shared/domain/repositories/get-available-app.repository'
import { GetOrCreateDomain } from '@/shared/application/get-or-create-domain'
import { GetOrCreateInstalledApp } from '@/shared/application/get-or-create-installed-app'
import { GetOrCreateCredential } from '@/shared/application/get-or-create-credential'
import { bitrixInstallBindRegistry } from '@/shared/infra/setup-bitrix-install-binds'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import z from 'zod'

export class InstallController extends Controller {
  constructor(
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getOrCreateDomain: GetOrCreateDomain,
    private readonly getOrCreateInstalledApp: GetOrCreateInstalledApp,
    private readonly getOrCreateCredential: GetOrCreateCredential,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = z
      .object({
        domain: z.string(),
        member_id: z.string(),
        app_code: z.string(),
        access_token: z.string(),
        refresh_token: z.string(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const { domain, member_id, app_code, access_token, refresh_token } =
      params.data

    const availableApp =
      await this.getAvailableAppRepository.getAvailableApp(app_code)

    if (!availableApp) {
      return this.notFound(new Error('Available app not found'))
    }

    const domainEntity = await this.getOrCreateDomain.execute({
      name: domain,
      memberId: member_id,
    })

    const installedApp = await this.getOrCreateInstalledApp.execute({
      domainId: domainEntity.id,
      appCodeId: availableApp.id,
    })

    await this.getOrCreateCredential.execute({
      appId: installedApp.id,
      clientId: availableApp.code,
      clientSecret: availableApp.secret,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    })

    const bitrixBinds = bitrixInstallBindRegistry.getBindsForApp(app_code)

    if (bitrixBinds.length > 0) {
      const bitrixClient = new BitrixRestClient(domain, access_token)
      for (const bind of bitrixBinds) {
        try {
          await bitrixClient.callMethod(bind.method, bind.params)
        } catch (error: any) {
          console.error(
            `Error binding ${bind.method} to Bitrix:`,
            (error as Error).message,
          )
        }
      }
    }

    return {
      result: {
        ...domainEntity,
        app: installedApp,
      },
      status: 200,
    }
  }
}
