import { Request, Response } from 'express'
import { oauthPopupHtml } from './oauth-popup-html'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { apiLogger } from '@/shared/infra/logger'
import { setLogContext } from '@/shared/infra/log-context'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { ContaAzulClient } from '@/shared/infra/clients/conta-azul.client'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { OAuthStateStore } from '../../infra/oauth-state.store'
import { env } from '@/config/env'
import { thinkAnaliseAuthTokenService } from '../../infra/auth-token.service'

const installedAppRepo = new PrismaInstalledAppRepository()

export class ContaAzulOAuthCallbackController extends Controller {
  constructor(private readonly stateStore: OAuthStateStore) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const frontendUrl = env.appUrl

    try {
      const { code, state } = req.query as Record<string, string | undefined>

      if (!code || !state) {
        throw new Error('Missing code or state')
      }

      const payload = this.stateStore.consume(state)
      if (!payload) {
        throw new Error('Invalid or expired state')
      }

      // Rota pública (sem authMiddleware): resolve o tenant pro log manualmente.
      setLogContext({ appId: payload.appId })
      try {
        const domain = await new PrismaDomainRepository().getDomainById(
          payload.domainId,
        )
        if (domain) setLogContext({ domain: domain.name })
      } catch {
        // segue sem o domínio
      }

      const tokens = await ContaAzulClient.exchangeCode(code)

      const app = await installedAppRepo.getByAppCodeAndDomainId(
        payload.appId,
        payload.domainId,
      )
      if (!app) throw new Error('App not found')

      const tokenKey = await thinkAnaliseAuthTokenService.upsert({
        appId: app.id,
        provider: 'conta_azul',
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        accountId: tokens.accountId,
        ...(payload.sourceId !== undefined && {
          bitrixSourceId: payload.sourceId,
        }),
      })

      const bitrix = (await makeBitrixClientByAppId(
        app.id,
        'biconnector',
      )) as BitrixBiConnectorClient

      let bitrixSourceId: number

      if (payload.sourceId !== undefined) {
        const result = await bitrix.sourceUpdate(payload.sourceId, {
          settings: { integration: 'conta_azul', api_key: tokenKey },
        })
        bitrixSourceId = result.id
      } else {
        const result = await bitrix.sourceAdd({
          connectorId: payload.connectorId,
          title: payload.title,
          settings: { integration: 'conta_azul', api_key: tokenKey },
          active: true,
        })
        bitrixSourceId = result.id
      }

      await thinkAnaliseAuthTokenService.updateBitrixSourceId(
        tokenKey,
        bitrixSourceId,
      )

      apiLogger.info(
        { app: 'thinkanalise', appId: app.id, bitrixSourceId },
        'Conta Azul conectada',
      )

      res.send(oauthPopupHtml('conta-azul-oauth', 'success'))
    } catch (error) {
      apiLogger.error(
        {
          app: 'thinkanalise',
          err: error instanceof Error ? error.message : String(error),
        },
        'OAuth Conta Azul callback falhou',
      )
      res.send(oauthPopupHtml('conta-azul-oauth', 'error'))
    }
    return this.ok(null)
  }
}
