import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { StartManualSubscriptionExpiration } from '@/modules/application/application/start-manual-subscription-expiration'
import {
  GetSubscriptionExpirationRun,
  ListSubscriptionExpirationRuns,
} from '../../application/subscription-expiration-runs'

export class ListSubscriptionExpirationRunsController extends Controller {
  constructor(private readonly listRuns: ListSubscriptionExpirationRuns) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        trigger: z.enum(['scheduled', 'manual']).optional(),
        /** Query string: só o literal `'true'` liga. */
        onlyWithChanges: z
          .enum(['true', 'false'])
          .optional()
          .transform(value => value === 'true'),
      })
      .safeParse(req.query)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    return this.ok(await this.listRuns.execute(parsed.data))
  }
}

export class GetSubscriptionExpirationRunController extends Controller {
  constructor(private readonly getRun: GetSubscriptionExpirationRun) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const run = await this.getRun.execute(String(req.params.id))
    if (!run) return this.notFound(new Error('Run not found'))

    return this.ok(run)
  }
}

export class StartSubscriptionExpirationRunController extends Controller {
  constructor(private readonly startRun: StartManualSubscriptionExpiration) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const portalUserId = req.portalUserId
    if (!portalUserId) return this.unauthorized(new Error('Unauthorized'))

    const result = await this.startRun.execute(portalUserId)

    if (result.status === 'started') {
      return this.accepted({ runId: result.runId })
    }

    /** `code` é o que a tela usa para escolher o aviso. */
    return {
      status: 409,
      result: {
        code: result.status,
        error:
          result.status === 'busy'
            ? 'Another expiration run is in progress'
            : 'Subscription expiration is disabled in this environment',
      },
    }
  }
}
