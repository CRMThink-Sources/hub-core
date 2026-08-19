import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ThinkzapLineCredentialMissingError } from '../../application/subscribe-thinkzap-line'
import { unsubscribeThinkzapLine } from '../../application/unsubscribe-thinkzap-line'
import { mapAdminLineError } from '../map-admin-line-error'

export class UnsubscribeThinkzapLineController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, subscriptionItemId } = req.params as {
      appId: string
      subscriptionItemId: string
    }

    try {
      await unsubscribeThinkzapLine(appId, subscriptionItemId)
      return this.ok({ message: 'Unsubscribed' })
    } catch (error) {
      const mapped = mapAdminLineError(error)
      if (mapped) return mapped
      if (error instanceof ThinkzapLineCredentialMissingError)
        return { status: 422, result: { error: error.message } }
      throw error
    }
  }
}
