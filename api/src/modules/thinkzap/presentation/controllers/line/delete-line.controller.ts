import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { DeleteLine } from '@/modules/thinkzap/application/delete-line'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * `DELETE /api/thinkzap/lines/:itemId` — apaga a linha.
 *
 * A rota mais destrutiva desta superfície: o item some, o recurso é desassinado no
 * provider e a cobrança muda. A guarda de posse é a mesma das outras — `itemId` é id
 * de item de SPA, adivinhável, e sem ela um id chutado apagaria linha de outro
 * cliente.
 *
 * **A limpeza é assíncrona.** A resposta confirma que o item foi apagado, não que o
 * número já foi desconectado — quem faz isso é o webhook de saída da SPA. A tela não
 * pode afirmar o contrário.
 */
export class DeleteLineController extends Controller {
  constructor(private readonly deleteLine: DeleteLine) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      await this.deleteLine.execute(input)

      return this.ok({ deleted: true })
    } catch (error) {
      return mapLineError(error, 'Falha ao excluir a linha')
    }
  }
}
