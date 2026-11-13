import { Request, Response } from 'express'
import z from 'zod'
import { env } from '@/config/env'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  GetInboundFailure,
  InboundReprocessStatus,
  ListInboundFailures,
  MAX_INBOUND_REPROCESS_BATCH,
  ReprocessInboundFailures,
} from '../../application/inbound-failures'
import {
  FAILURE_RANGE_ORDER_MESSAGE,
  failureListBaseShape,
  failureRangeIsOrdered,
  failureRangeMessage,
  failureRangeWithinRetention,
  resolveFailureRange,
} from './failure-list-query'

const SOURCES = [
  'z-api',
  'bitrix',
  'hubmessage',
  'hubmessage-status',
  'bitrix-bot',
] as const

function inboundListQuerySchema(retentionDays: number) {
  return z
    .object({
      ...failureListBaseShape,
      /** Sem situação = as duas. */
      status: z.enum(['FAILED', 'REPROCESSED']).optional(),
      source: z.enum(SOURCES).optional(),
    })
    .transform(query => ({
      ...query,
      ...resolveFailureRange(query, retentionDays),
    }))
    .refine(failureRangeIsOrdered, { message: FAILURE_RANGE_ORDER_MESSAGE })
    .refine(query => failureRangeWithinRetention(query, retentionDays), {
      message: failureRangeMessage(retentionDays),
    })
}

export class ListInboundFailuresController extends Controller {
  private readonly listQuerySchema: ReturnType<typeof inboundListQuerySchema>

  constructor(
    private readonly listFailures: ListInboundFailures,
    /** Prazo de guarda: é o período padrão e o máximo da lista. */
    private readonly retentionDays: number = env.failureRetention.days,
  ) {
    super()
    this.listQuerySchema = inboundListQuerySchema(retentionDays)
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = this.listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues.map(issue => issue.message).join('; ')),
      )
    }

    const { status, ...filters } = parsed.data

    return this.ok({
      ...(await this.listFailures.execute({
        ...filters,
        statuses: status ? [status] : ['FAILED', 'REPROCESSED'],
      })),
      retentionDays: this.retentionDays,
    })
  }
}

export class GetInboundFailureController extends Controller {
  constructor(private readonly getFailure: GetInboundFailure) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const failure = await this.getFailure.execute(String(req.params.id))
    if (!failure) {
      return this.notFound(
        new Error(
          'Falha de recebimento não encontrada (ou já passou do prazo de guarda)',
        ),
      )
    }

    return this.ok(failure)
  }
}

/** Mensagem por status recusado; a tela escolhe o aviso pelo `code`. */
const REFUSAL: Record<
  Exclude<InboundReprocessStatus, 'requeued'>,
  { status: number; message: string }
> = {
  conflict: {
    status: 409,
    message: 'Esta falha já foi reprocessada.',
  },
  'not-reprocessable': {
    status: 422,
    message:
      'Esta origem não pode ser reprocessada: reentregar o evento poderia duplicar uma mensagem ou repetir uma ação no cliente.',
  },
  'not-found': {
    status: 404,
    message:
      'Falha de recebimento não encontrada (ou já passou do prazo de guarda).',
  },
  'schedule-failed': {
    status: 503,
    message: 'Não foi possível agendar o reprocessamento. Tente de novo.',
  },
}

export class ReprocessInboundFailureController extends Controller {
  constructor(private readonly reprocess: ReprocessInboundFailures) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const portalUserId = req.portalUserId
    if (!portalUserId) return this.unauthorized(new Error('Unauthorized'))

    const id = String(req.params.id)
    const [result] = await this.reprocess.execute({
      ids: [id],
      portalUserId,
    })

    if (!result || result.status === 'requeued') {
      return this.accepted({ id, status: 'requeued' })
    }

    const refusal = REFUSAL[result.status]
    return {
      status: refusal.status,
      result: { error: refusal.message, code: result.status },
    }
  }
}

const batchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_INBOUND_REPROCESS_BATCH),
})

export class ReprocessInboundFailuresBatchController extends Controller {
  constructor(private readonly reprocess: ReprocessInboundFailures) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const portalUserId = req.portalUserId
    if (!portalUserId) return this.unauthorized(new Error('Unauthorized'))

    const parsed = batchSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const results = await this.reprocess.execute({
      ids: parsed.data.ids,
      portalUserId,
    })

    return this.ok({ results })
  }
}
