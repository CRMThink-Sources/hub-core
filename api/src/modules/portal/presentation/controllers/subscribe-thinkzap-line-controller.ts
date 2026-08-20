import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  ThinkzapLineCredentialMissingError,
  subscribeThinkzapLine,
} from '../../application/subscribe-thinkzap-line'
import { mapAdminLineError } from '../map-admin-line-error'

export class SubscribeThinkzapLineController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, subscriptionItemId } = req.params as {
      appId: string
      subscriptionItemId: string
    }

    try {
      await subscribeThinkzapLine(appId, subscriptionItemId)
      return this.ok({ message: 'Subscribed' })
    } catch (error) {
      const mapped = mapAdminLineError(error)
      if (mapped) return mapped
      if (error instanceof ThinkzapLineCredentialMissingError)
        return { status: 422, result: { error: error.message } }
      throw error
    }
  }
}
