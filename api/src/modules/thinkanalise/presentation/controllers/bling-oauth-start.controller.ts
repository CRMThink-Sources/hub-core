import { randomUUID } from 'node:crypto'
import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { OAuthStateStore } from '../../infra/oauth-state.store'
import { env } from '@/config/env'
import { thinkanaliseError } from '../../errors/catalog'

export class BlingOAuthStartController extends Controller {
  constructor(private readonly stateStore: OAuthStateStore) {
    super()
  }

  perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.appId
    const domainId = req.domainId
    if (!appId || !domainId)
      throw thinkanaliseError('thinkanalise.request.app_context_missing')

    const clientId = env.bling.ClientId
    const authUrl = env.bling.AuthUrl
    // precisa bater com o callback cadastrado na Área do Integrador
    const redirectUri = `${env.apiUrl}/thinkanalise/oauth/bling/callback`

    if (!clientId || !authUrl) {
      throw thinkanaliseError('thinkanalise.oauth.bling_not_configured')
    }

    const sourceIdParsed = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(req.query.sourceId)

    const connectorIdParsed = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(req.query.connectorId)

    const titleParsed = z.string().min(1).safeParse(req.query.title)

    const state = randomUUID()

    if (sourceIdParsed.success) {
      this.stateStore.set(state, {
        appId,
        domainId,
        sourceId: sourceIdParsed.data,
      })
    } else if (connectorIdParsed.success && titleParsed.success) {
      this.stateStore.set(state, {
        appId,
        domainId,
        connectorId: connectorIdParsed.data,
        title: titleParsed.data,
      })
    } else {
      throw thinkanaliseError('thinkanalise.oauth.params_invalid')
    }

    const url = new URL(authUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)

    return Promise.resolve(this.ok({ url: url.toString() }))
  }
}
