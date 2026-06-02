import { randomUUID } from 'node:crypto'
import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GoogleOAuthGateway } from '../../domain/gateways/google-oauth.gateway'
import { GoogleOAuthStateStore } from '../../infra/google-oauth-state.store'
import { IMPORTSHEET_APP_CODE_ID } from '../../importsheet.constants'

export class GoogleOAuthUrlController extends Controller {
  constructor(
    private readonly gateway: GoogleOAuthGateway,
    private readonly stateStore: GoogleOAuthStateStore,
  ) {
    super()
  }

  perform(req: Request): Promise<httpResponse> {
    const appId = req.appId
    const domainId = req.domainId
    if (!appId || !domainId) {
      return Promise.resolve(this.badRequest(new Error('Missing app context')))
    }
    if (appId !== IMPORTSHEET_APP_CODE_ID) {
      return Promise.resolve(
        this.badRequest(new Error('Not an ImportSheet app')),
      )
    }

    const state = randomUUID()
    this.stateStore.set(state, { appId, domainId })

    const url = this.gateway.buildAuthUrl({ state })
    return Promise.resolve(this.ok({ url }))
  }
}
