import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'

/** Limite por chamada: o widget só acompanha o que enviou na própria sessão. */
const MAX_IDS = 50

const schema = z.object({
  ids: z
    .string()
    .min(1)
    .transform(raw =>
      raw
        .split(',')
        .map(id => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1)).min(1).max(MAX_IDS)),
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

export type WidgetOutboxStatusView =
  | 'queued'
  | 'waiting'
  | 'sent'
  | 'failed'
  | 'unknown'

export type OutboxStatusReader = {
  findByClientMessageIds(
    domainId: string,
    clientMessageIds: string[],
  ): Promise<WidgetOutboxRecord[]>
}

/**
 * `waiting` só enquanto a row está PENDING com a espera da cadência no futuro; a
 * espera vencida volta a ser `queued` (o job está saindo).
 */
export function toWidgetOutboxStatus(
  row: Pick<WidgetOutboxRecord, 'status' | 'cadenceWaitUntil'>,
  now: Date,
): { status: WidgetOutboxStatusView; waitUntil: string | null } {
  switch (row.status) {
    case 'SENT':
      return { status: 'sent', waitUntil: null }
    case 'FAILED':
      return { status: 'failed', waitUntil: null }
    case 'UNKNOWN':
      return { status: 'unknown', waitUntil: null }
    case 'PENDING':
      if (row.cadenceWaitUntil && row.cadenceWaitUntil > now) {
        return {
          status: 'waiting',
          waitUntil: row.cadenceWaitUntil.toISOString(),
        }
      }
      return { status: 'queued', waitUntil: null }
    default:
      return { status: 'queued', waitUntil: null }
  }
}

/**
 * `GET /api/thinkzap/messages/outbox-status?ids=a,b,c` — o status das mensagens que
 * o widget enviou, para mostrar "aguardando janela de envio".
 *
 * A instalação vem do JWT: id de outra instalação simplesmente não aparece. Só
 * status e horário saem — texto e destino não, a rota é aberta a qualquer usuário
 * do widget.
 */
export class GetOutboxStatusController extends Controller {
  constructor(
    private readonly outbox: OutboxStatusReader,
    private readonly now: () => Date = () => new Date(),
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const parsed = schema.safeParse({
      ids: req.query.ids,
      domainId: req.domainId,
      appCode: req.appId,
    })
    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    const { ids, domainId, appCode } = parsed.data
    const rows = await this.outbox.findByClientMessageIds(domainId, ids)
    const now = this.now()

    return this.ok({
      messages: rows
        .filter(row => row.appCode === appCode)
        .map(row => ({
          clientMessageId: row.clientMessageId,
          ...toWidgetOutboxStatus(row, now),
        })),
    })
  }
}
