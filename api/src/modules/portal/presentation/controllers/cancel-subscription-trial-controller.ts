import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { cancelSubscriptionTrial } from '../../application/cancel-subscription-trial'
import {
  PortalAppNotFoundError,
  PortalSubscriptionNotFoundError,
} from '../../domain/errors/portal-domain.errors'

export class CancelSubscriptionTrialController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId, subscriptionId } = req.params

    if (
      !appId ||
      typeof appId !== 'string' ||
      !subscriptionId ||
      typeof subscriptionId !== 'string'
    ) {
      return this.badRequest(new Error('Invalid appId or subscriptionId'))
    }

    try {
      await cancelSubscriptionTrial({ appId, subscriptionId })
      return this.ok({ message: 'Trial cancelled' })
    } catch (error) {
      if (error instanceof PortalAppNotFoundError) return this.notFound(error)
      if (error instanceof PortalSubscriptionNotFoundError)
        return this.notFound(error)
      throw error
    }
  }
}
