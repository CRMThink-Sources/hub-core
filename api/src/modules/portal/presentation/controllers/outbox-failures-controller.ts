import { Request, Response } from 'express'
import z from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  GetOutboxFailure,
  ListOutboxFailures,
  MAX_REPROCESS_BATCH,
  ReprocessOutboxFailures,
  ReprocessStatus,
} from '../../application/outbox-failures'

const DAY_MS = 24 * 60 * 60 * 1000
/** Período padrão da lista quando a tela não manda datas. */
export const DEFAULT_FAILURE_RANGE_DAYS = 7
/** Teto de um período: segura o `count` sobre a outbox inteira. */
export const MAX_FAILURE_RANGE_DAYS = 90

const ORIGINS = [
  'WIDGET',
  'WIDGET_ATTACHMENT',
  'ROBOT_MESSAGE',
  'ROBOT_BUTTONS',
  'ROBOT_TEMPLATE',
  'SMS_CAMPAIGN',
  'OPERATOR',
  'BOT',
] as const

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    /** Sem status = os dois. */
    status: z.enum(['FAILED', 'UNKNOWN']).optional(),
    domain: z.string().trim().min(1).max(255).optional(),
    origin: z.enum(ORIGINS).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .transform(query => {
    const to = query.to ?? new Date()
    const from =
      query.from ?? new Date(to.getTime() - DEFAULT_FAILURE_RANGE_DAYS * DAY_MS)
    return { ...query, from, to }
  })
  .refine(query => query.from <= query.to, {
    message: '`from` deve ser anterior a `to`',
  })
  .refine(
    query =>
      query.to.getTime() - query.from.getTime() <=
      MAX_FAILURE_RANGE_DAYS * DAY_MS,
    { message: `O período máximo é de ${MAX_FAILURE_RANGE_DAYS} dias` },
  )

export class ListOutboxFailuresController extends Controller {
  constructor(private readonly listFailures: ListOutboxFailures) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues.map(issue => issue.message).join('; ')),
      )
    }

    const { status, ...filters } = parsed.data

    return this.ok(
      await this.listFailures.execute({
        ...filters,
        statuses: status ? [status] : ['FAILED', 'UNKNOWN'],
      }),
    )
  }
}

export class GetOutboxFailureController extends Controller {
  constructor(private readonly getFailure: GetOutboxFailure) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const failure = await this.getFailure.execute(String(req.params.id))
    if (!failure)
      return this.notFound(new Error('Falha de envio não encontrada'))

    return this.ok(failure)
  }
}

const acknowledgeSchema = z.object({
  acknowledgeDuplicateRisk: z.boolean().default(false),
})

/** Mensagem por status recusado; a tela escolhe o aviso pelo `code`. */
const REFUSAL: Record<
  Exclude<ReprocessStatus, 'requeued'>,
  { status: number; message: string }
> = {
  conflict: {
    status: 409,
    message:
      'A mensagem não está mais com falha (já foi reenviada ou está em envio).',
  },
  'needs-confirmation': {
    status: 422,
    message:
      'Resultado indeterminado: confirme o risco de o contato receber a mensagem duas vezes.',
  },
  'not-found': { status: 404, message: 'Falha de envio não encontrada' },
  'schedule-failed': {
    status: 503,
    message: 'Não foi possível agendar o reprocessamento. Tente de novo.',
  },
}

export class ReprocessOutboxFailureController extends Controller {
  constructor(private readonly reprocess: ReprocessOutboxFailures) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const portalUserId = req.portalUserId
    if (!portalUserId) return this.unauthorized(new Error('Unauthorized'))

    const parsed = acknowledgeSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const id = String(req.params.id)
    const [result] = await this.reprocess.execute({
      ids: [id],
      portalUserId,
      acknowledgeDuplicateRisk: parsed.data.acknowledgeDuplicateRisk,
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

const batchSchema = acknowledgeSchema.extend({
  ids: z.array(z.string().min(1)).min(1).max(MAX_REPROCESS_BATCH),
})

export class ReprocessOutboxFailuresBatchController extends Controller {
  constructor(private readonly reprocess: ReprocessOutboxFailures) {
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
      acknowledgeDuplicateRisk: parsed.data.acknowledgeDuplicateRisk,
    })

    return this.ok({ results })
  }
}
