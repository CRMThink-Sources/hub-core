import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { registerSmsProviderForApp } from '../../application/register-sms-provider-for-app'
import {
  DomainCredentialMissingError,
  PortalDomainNotFoundError,
  ThinkzapNotInstalledError,
} from '../../domain/errors/portal-domain.errors'
import { mapAdminLineError } from '../map-admin-line-error'

export class RegisterSmsProviderAppController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, subscriptionItemId } = req.params as {
      appId: string
      subscriptionItemId: string
    }

    try {
      return this.ok(await registerSmsProviderForApp(appId, subscriptionItemId))
    } catch (error) {
      const mapped = mapAdminLineError(error)
      if (mapped) return mapped
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
