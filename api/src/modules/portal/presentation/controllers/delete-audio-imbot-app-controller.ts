import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { deleteAudioImbotForApp } from '../../application/delete-audio-imbot-for-app'
import {
  DomainCredentialMissingError,
  ThinkzapNotInstalledError,
} from '../../domain/errors/portal-domain.errors'
import { PortalDomainNotFoundError } from '../../domain/errors/portal-domain.errors'

export class DeleteAudioImbotAppController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = req.params.appId

    if (!appId || typeof appId !== 'string') {
      return this.badRequest(new Error('Invalid app id'))
    }

    try {
      const output = await deleteAudioImbotForApp(appId)
      return this.ok(output)
    } catch (error) {
      if (error instanceof PortalDomainNotFoundError) {
        return this.notFound(error)
      }
      if (error instanceof ThinkzapNotInstalledError) {
        return { status: 422, result: { error: error.message } }
      }
      if (error instanceof DomainCredentialMissingError) {
        return { status: 422, result: { error: error.message } }
      }
      throw error
    }
  }
}
