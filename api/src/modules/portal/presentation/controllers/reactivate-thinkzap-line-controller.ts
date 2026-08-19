import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  ThinkzapLineNotInactiveError,
  reactivateThinkzapLine,
} from '../../application/reactivate-thinkzap-line'
import { mapAdminLineError } from '../map-admin-line-error'

export class ReactivateThinkzapLineController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, subscriptionItemId } = req.params as {
      appId: string
      subscriptionItemId: string
    }

    try {
      const item = await reactivateThinkzapLine(appId, subscriptionItemId)
      return this.ok({
        message: 'Line reactivated',
        subscriptionItemId: item.id,
        itemStatus: item.status,
      })
    } catch (error) {
      const mapped = mapAdminLineError(error)
      if (mapped) return mapped
      if (error instanceof ThinkzapLineNotInactiveError)
        return { status: 422, result: { error: error.message } }
      throw error
    }
  }
}
