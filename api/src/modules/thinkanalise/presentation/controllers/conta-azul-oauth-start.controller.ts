import { randomUUID } from 'node:crypto'
import { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ContaAzulOAuthStateStore } from '../../infra/conta-azul-oauth-state.store'
import { env } from '@/config/env'

export class ContaAzulOAuthStartController extends Controller {
  constructor(private readonly stateStore: ContaAzulOAuthStateStore) {
    super()
  }

  perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.appId
    const domainId = req.domainId
    if (!appId || !domainId)
      return Promise.resolve(this.badRequest(new Error('Missing app context')))

    const apiUrl = env.apiUrl

    const clientId = env.contaAzul.ClientId
    const redirectUri = `${apiUrl}/thinkanalise/oauth/conta-azul/callback`
    const authUrl = env.contaAzul.AuthUrl

    if (!clientId || !redirectUri || !authUrl) {
      throw new Error('Conta Azul OAuth not configured')
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
      return Promise.resolve(
        this.badRequest(
          new Error('Provide either sourceId or connectorId+title'),
        ),
      )
    }

    const url = new URL(authUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set(
      'scope',
      'openid profile aws.cognito.signin.user.admin',
    )

    return Promise.resolve(this.ok({ url: url.toString() }))
  }
}
