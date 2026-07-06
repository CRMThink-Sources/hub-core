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
import { thinkAnaliseAuthTokenService } from '@/modules/thinkanalise/infra/auth-token.service'

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
}

export class CheckController extends CallbackController {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const body = req.body as Record<string, unknown>
    const settings =
      (body.connection as Record<string, string> | undefined) ??
      (body as Record<string, string>)

    if (!settings?.api_key || !settings?.integration) {
      return this.badRequest(new Error('Missing connection parameters'))
    }

    const check = CHECKERS[settings.integration]
    if (!check) {
      return this.badRequest(
        new Error(`Provider '${settings.integration}' not supported`),
      )
    }

    try {
      await check(settings.api_key)
    } catch (error) {
      if (
        (axios.isAxiosError(error) &&
          error.response &&
          error.response.status < 500) ||
        (error instanceof Error && error.message === 'Invalid credentials')
      ) {
        return this.badRequest(new Error('Invalid credentials'))
      }
      throw error
    }

    return this.ok({ ok: true })
  }
}
