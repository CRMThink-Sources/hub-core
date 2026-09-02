import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  ForeignSmsSenderCodeError,
  deleteSmsProviderByCodeForApp,
} from '../../application/list-sms-providers-for-app'
import {
  DomainCredentialMissingError,
  PortalDomainNotFoundError,
  ThinkzapNotInstalledError,
} from '../../domain/errors/portal-domain.errors'
import { mapAdminLineError } from '../map-admin-line-error'

/**
 * Remoção de sender **órfão**, pelo `CODE` cru.
 *
 * A rota da linha não alcança órfão: o item que geraria o `CODE` já não existe.
 */
export class DeleteSmsProviderByCodeAppController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, code } = req.params as { appId: string; code: string }

    try {
      return this.ok(await deleteSmsProviderByCodeForApp(appId, code))
    } catch (error) {
      const mapped = mapAdminLineError(error)
      if (mapped) return mapped
      if (error instanceof ForeignSmsSenderCodeError) {
        return { status: 422, result: { error: error.message } }
      }
      if (error instanceof PortalDomainNotFoundError) {
        return this.notFound(error)
      }
      if (
        error instanceof ThinkzapNotInstalledError ||
        error instanceof DomainCredentialMissingError
      ) {
        return { status: 422, result: { error: error.message } }
      }
      throw error
    }
  }
}
