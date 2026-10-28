import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { StartManualStripeSync } from '@/modules/thinkzap/application/start-manual-stripe-sync'
import {
  GetStripeSyncRun,
  ListStripeSyncRuns,
} from '../../application/stripe-sync-runs'

export class ListStripeSyncRunsController extends Controller {
  constructor(private readonly listRuns: ListStripeSyncRuns) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        trigger: z.enum(['scheduled', 'manual']).optional(),
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

export class GetStripeSyncRunController extends Controller {
  constructor(private readonly getRun: GetStripeSyncRun) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const run = await this.getRun.execute(String(req.params.id))
    if (!run) return this.notFound(new Error('Run not found'))

    return this.ok(run)
  }
}

export class StartStripeSyncRunController extends Controller {
  constructor(
    private readonly startRun: Pick<StartManualStripeSync, 'execute'>,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const portalUserId = req.portalUserId
    if (!portalUserId) return this.unauthorized(new Error('Unauthorized'))

    const result = await this.startRun.execute(portalUserId)

    if (result.status === 'started') {
      return this.accepted({ runId: result.runId })
    }

    return {
      status: 409,
      result: {
        code: result.status,
        error:
          result.status === 'busy'
            ? 'Another Stripe sync run is in progress'
            : 'Stripe sync is disabled in this environment',
      },
    }
  }
}
