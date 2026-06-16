import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { createTrialSubscriptionForApp } from '../../application/create-trial-subscription-for-app'
import { PortalAppNotFoundError } from '../../domain/errors/portal-domain.errors'
import z from 'zod'

export class CreateTrialSubscriptionAppController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const { appId } = req.params

    if (!appId || typeof appId !== 'string') {
      return this.badRequest(new Error('Invalid appId'))
    }

    const body = z
      .object({ trialDays: z.number().int().min(1) })
      .safeParse(req.body)

    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    try {
      const result = await createTrialSubscriptionForApp({
        appId,
        trialDays: body.data.trialDays,
      })
      return this.ok(result)
    } catch (error) {
      if (error instanceof PortalAppNotFoundError) return this.notFound(error)
      throw error
    }
  }
}
