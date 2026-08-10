import axios from 'axios'
import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { CallbackController } from '@/shared/presentation/callback-controller'
import { AsaasClient } from '@/shared/infra/clients/asaas.client'
import {
  SonaxClient,
  parseSonaxCredentials,
} from '@/shared/infra/clients/sonax.client'
import {
  OmieClient,
  parseOmieCredentials,
} from '@/shared/infra/clients/omie.client'
import { BlingClient } from '@/shared/infra/clients/bling.client'
import { thinkAnaliseAuthTokenService } from '@/modules/thinkanalise/infra/auth-token.service'
import { AppError } from '@/shared/domain/errors/app-error'
import { thinkanaliseError } from '@/modules/thinkanalise/errors/catalog'

const CHECKERS: Record<string, (apiKey: string) => Promise<void>> = {
  asaas: apiKey => new AsaasClient(apiKey).check(),
  conta_azul: async tokenKey => {
    await thinkAnaliseAuthTokenService.getAccessToken('conta_azul', tokenKey)
  },
  sonax: async apiKey => {
    const { idCliente, token } = parseSonaxCredentials(apiKey)
    await new SonaxClient(idCliente, token).check()
  },
  omie: async apiKey => {
    const { appKey, appSecret } = parseOmieCredentials(apiKey)
    await new OmieClient(appKey, appSecret).check()
  },
  bling: async tokenKey => {
    // refresh ok não garante app instalado — check() pega token revogado na conta Bling
    const { accessToken } = await thinkAnaliseAuthTokenService.getAccessToken(
      'bling',
      tokenKey,
    )
    await new BlingClient(accessToken).check()
  },
}

export class CheckController extends CallbackController {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const body = req.body as Record<string, unknown>
    const settings =
      (body.connection as Record<string, string> | undefined) ??
      (body as Record<string, string>)

    if (!settings?.api_key || !settings?.integration) {
      throw thinkanaliseError('thinkanalise.callback.connection_missing')
    }

    const check = CHECKERS[settings.integration]
    if (!check) {
      throw thinkanaliseError('thinkanalise.callback.provider_unsupported')
    }

    try {
      await check(settings.api_key)
    } catch (error) {
      if (error instanceof AppError) throw error // token.* já classificado
      const isCredential =
        (axios.isAxiosError(error) &&
          error.response &&
          error.response.status < 500) ||
        (error instanceof Error && error.message === 'Invalid credentials')
      throw thinkanaliseError(
        isCredential
          ? 'thinkanalise.credentials.invalid'
          : 'thinkanalise.provider.check_failed',
        error,
      )
    }

    return this.ok({ ok: true })
  }
}
