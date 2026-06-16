import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { extendSubscriptionTrial } from '../../application/extend-subscription-trial'
import {
  PortalAppNotFoundError,
  PortalSubscriptionNotFoundError,
} from '../../domain/errors/portal-domain.errors'
import z from 'zod'

export class ExtendSubscriptionTrialController extends Controller {
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

    const body = z
      .object({ trialEndsAt: z.string().datetime() })
      .safeParse(req.body)

    if (!body.success) {
      return this.badRequest(
        new Error('Invalid trialEndsAt: ' + body.error.message),
      )
    }

    try {
      const result = await extendSubscriptionTrial({
        appId,
        subscriptionId,
        trialEndsAt: new Date(body.data.trialEndsAt),
      })
      return this.ok(result)
    } catch (error) {
      if (error instanceof PortalAppNotFoundError) return this.notFound(error)
      if (error instanceof PortalSubscriptionNotFoundError)
        return this.notFound(error)
      throw error
    }
  }
}
