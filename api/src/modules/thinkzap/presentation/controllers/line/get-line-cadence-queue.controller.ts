import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ListLineCadenceQueue } from '@/modules/thinkzap/application/list-line-cadence-queue'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * `GET /api/thinkzap/lines/:itemId/cadence/queue` — as mensagens que aguardam na
 * fila da linha, na ordem de saída. Mesma permissão de ler os ajustes.
 */
export class GetLineCadenceQueueController extends Controller {
  constructor(private readonly listQueue: ListLineCadenceQueue) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      return this.ok(await this.listQueue.execute(input))
    } catch (error) {
      return mapLineError(error, 'Falha ao ler a fila de envio da linha')
    }
  }
}
