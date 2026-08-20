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
import { AppError } from '@/shared/domain/errors/app-error'
import { appErrorLogFields } from '@/shared/infra/log-error'
import { thinkanaliseError } from '../../errors/catalog'

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
        throw thinkanaliseError('thinkanalise.oauth.callback_missing_params')
      }

      const payload = this.stateStore.consume(state)
      if (!payload) {
        throw thinkanaliseError('thinkanalise.oauth.state_invalid_or_expired')
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

      let tokens
      try {
        tokens = await ContaAzulClient.exchangeCode(code)
      } catch (error) {
        throw thinkanaliseError(
          'thinkanalise.oauth.code_exchange_failed',
          error,
        )
      }

      const app = await installedAppRepo.getByAppCodeAndDomainId(
        payload.appId,
        payload.domainId,
      )
      if (!app) throw thinkanaliseError('thinkanalise.connector.app_not_found')

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
      // Popup responde 200 HTML por design → via B. Erro não-classificado após a
      // troca de token = falha ao finalizar (salvar token / atualizar source).
      const appErr =
        error instanceof AppError
          ? error
          : thinkanaliseError('thinkanalise.oauth.finalize_failed', error)
      const level = appErr.httpStatus >= 500 ? 'error' : 'warn'
      apiLogger[level](
        appErrorLogFields(appErr, { app: 'thinkanalise' }),
        appErr.userCause,
      )
      res.send(oauthPopupHtml('conta-azul-oauth', 'error'))
    }
    return this.ok(null)
  }
}
