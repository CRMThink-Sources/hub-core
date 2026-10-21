import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import {
  CADENCE_QUEUE_MAX_PAGE_SIZE,
  ListLineCadenceQueue,
} from '@/modules/thinkzap/application/list-line-cadence-queue'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/** Os dois chegam como texto na query; ausentes, o caso de uso aplica o padrão. */
const querySchema = z.object({
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CADENCE_QUEUE_MAX_PAGE_SIZE)
    .optional(),
})

/**
 * `GET /api/thinkzap/lines/:itemId/cadence/queue?offset=0&limit=10` — uma página das
 * mensagens que aguardam na fila da linha, na ordem de saída. Mesma permissão de ler
 * os ajustes.
 */
export class GetLineCadenceQueueController extends Controller {
  constructor(private readonly listQueue: ListLineCadenceQueue) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)
    const query = querySchema.safeParse(req.query ?? {})
    if (!query.success) {
      return this.badRequest(
        new Error('Invalid request: ' + query.error.message),
      )
    }

    try {
      return this.ok(await this.listQueue.execute({ ...input, ...query.data }))
    } catch (error) {
      return mapLineError(error, 'Falha ao ler a fila de envio da linha')
    }
  }
}
