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
import { appIdResolver } from './helpers/app-id-resolver'
import { GetOrCreateSpa } from '@/shared/application/get-or-create-spa'

export class InstallController extends Controller {
  constructor(
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getOrCreateDomain: GetOrCreateDomain,
    private readonly getOrCreateInstalledApp: GetOrCreateInstalledApp,
    private readonly getOrCreateCredential: GetOrCreateCredential,
    private readonly getOrCreateSpa: GetOrCreateSpa,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const params = z
      .object({
        domain: z.string(),
        member_id: z.string(),
        app_code: z.string(),
        email: z.string(),
        access_token: z.string(),
        refresh_token: z.string(),
        expires_in: z.number(),
      })
      .safeParse(req.body)

    if (!params.success) {
      return this.badRequest(
        new Error('Invalid request: ' + params.error.message),
      )
    }

    const {
      domain,
      member_id,
      app_code,
      access_token,
      refresh_token,
      email,
      expires_in,
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

    const installedApp = await this.getOrCreateInstalledApp.execute({
      domainId: domainEntity.id,
      appCodeId: availableApp.id,
      email: email,
    })

    await this.getOrCreateCredential.execute({
      appId: installedApp.id,
      clientId: availableApp.code,
      clientSecret: availableApp.secret,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(expires_in),
    })

    const bitrixClient = new BitrixRestClient(domain, access_token)

    const bitrixBinds = bitrixInstallBindRegistry.getBindsForApp(appId)

    if (bitrixBinds.length > 0) {
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

    await bitrixInstallBindRegistry.runOnInstall(appId, bitrixClient)
    await this.getOrCreateSpa.execute({
      appId: installedApp.appCodeId,
      domain: domain,
      company: '',
      email: email,
      memberId: member_id,
      name: '',
      phone: '',
    })

    return {
      result: {
        ...domainEntity,
        app: installedApp,
      },
      status: 200,
    }
  }
}
