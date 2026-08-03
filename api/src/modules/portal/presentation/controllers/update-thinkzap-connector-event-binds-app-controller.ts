import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  ThinkzapLineNotFoundError,
  updateThinkzapConnectorEventBinds,
} from '../../application/update-thinkzap-connector-event-binds'
import {
  DomainCredentialMissingError,
  ThinkzapNotInstalledError,
} from '../../domain/errors/portal-domain.errors'

export class UpdateThinkzapConnectorEventBindsAppController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, subscriptionItemId } = req.params

    if (!appId || typeof appId !== 'string') {
      return this.badRequest(new Error('Invalid app id'))
    }

    if (!subscriptionItemId || typeof subscriptionItemId !== 'string') {
      return this.badRequest(new Error('Invalid subscription item id'))
    }

    const { messageUpdateEventEnabled, messageDeleteEventEnabled } =
      req.body as {
        messageUpdateEventEnabled?: boolean
        messageDeleteEventEnabled?: boolean
      }

    if (
      messageUpdateEventEnabled === undefined &&
      messageDeleteEventEnabled === undefined
    ) {
      return this.badRequest(new Error('No fields to update'))
    }

    if (
      messageUpdateEventEnabled !== undefined &&
      typeof messageUpdateEventEnabled !== 'boolean'
    ) {
      return this.badRequest(
        new Error('messageUpdateEventEnabled must be boolean'),
      )
    }

    if (
      messageDeleteEventEnabled !== undefined &&
      typeof messageDeleteEventEnabled !== 'boolean'
    ) {
      return this.badRequest(
        new Error('messageDeleteEventEnabled must be boolean'),
      )
    }

    try {
      await updateThinkzapConnectorEventBinds({
        appId,
        subscriptionItemId,
        messageUpdateEventEnabled,
        messageDeleteEventEnabled,
      })
      return this.ok({})
    } catch (error) {
      if (error instanceof ThinkzapNotInstalledError) {
        return { status: 422, result: { error: (error as Error).message } }
      }
      if (error instanceof DomainCredentialMissingError) {
        return { status: 422, result: { error: (error as Error).message } }
      }
      if (error instanceof ThinkzapLineNotFoundError) {
        return this.notFound(error)
      }
      throw error
    }
  }
}
