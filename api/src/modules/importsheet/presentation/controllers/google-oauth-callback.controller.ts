import { Request, Response } from 'express'
import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GoogleConnectionService } from '../../application/google-connection.service'
import { GoogleOAuthStateStore } from '../../infra/google-oauth-state.store'

function oauthPopupHtml(status: 'success' | 'error'): string {
  const origin = env.frontUrl || env.appUrl || '*'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
    try { window.opener.postMessage({ type: 'google-oauth', status: '${status}' }, '${origin}') } catch(_) {}
    window.close()
  </script></body></html>`
}

export class GoogleOAuthCallbackController extends Controller {
  constructor(
    private readonly stateStore: GoogleOAuthStateStore,
    private readonly installedAppRepository: GetInstalledAppRepository,
    private readonly googleConnection: GoogleConnectionService,
  ) {
    super()
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    try {
      const { code, state } = req.query as Record<string, string | undefined>
      if (!code || !state) {
        throw new Error('Missing code or state')
      }

      const payload = this.stateStore.consume(state)
      if (!payload) {
        throw new Error('Invalid or expired state')
      }

      const app = await this.installedAppRepository.getByAppCodeAndDomainId(
        payload.appId,
        payload.domainId,
      )
      if (!app) throw new Error('App not found')

      await this.googleConnection.connect(app.id, code)

      res.send(oauthPopupHtml('success'))
    } catch (error) {
      console.error('[GoogleOAuthCallback]', error)
      res.send(oauthPopupHtml('error'))
    }
    return this.ok(null)
  }
}
