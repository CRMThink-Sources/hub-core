import { Request, Response } from 'express'

function oauthPopupHtml(status: 'success' | 'error'): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
    try { window.opener.postMessage({ type: 'conta-azul-oauth', status: '${status}' }, '*') } catch(_) {}
    window.close()
  </script></body></html>`
}
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ContaAzulClient } from '@/shared/infra/clients/conta-azul.client'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { ContaAzulOAuthStateStore } from '../../infra/conta-azul-oauth-state.store'
import { env } from '@/config/env'
import { thinkAnaliseAuthTokenService } from '../../infra/auth-token.service'

const installedAppRepo = new PrismaInstalledAppRepository()

export class ContaAzulOAuthCallbackController extends Controller {
  constructor(private readonly stateStore: ContaAzulOAuthStateStore) {
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

      res.send(oauthPopupHtml('success'))
    } catch (error) {
      console.error('[ContaAzulOAuthCallback]', error)
      res.send(oauthPopupHtml('error'))
    }
    return this.ok(null)
  }
}
