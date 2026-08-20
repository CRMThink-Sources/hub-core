import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetLineConnection } from '@/modules/thinkzap/application/get-line-connection'
import { mapLineConnectionToView } from '@/modules/thinkzap/presentation/mappers/line-connection.mapper'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * `GET /api/thinkzap/lines/:itemId/connection` — estado da conexão da linha.
 *
 * Controller fino: valida a entrada, delega, mapeia. A redação da credencial é do
 * mapper, não daqui.
 */
export class GetLineConnectionController extends Controller {
  constructor(private readonly getLineConnection: GetLineConnection) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      const reading = await this.getLineConnection.execute(input)
      return this.ok(mapLineConnectionToView(reading))
    } catch (error) {
      /**
       * Falha na leitura do estado vira `502`, nunca `200` com
       * `connected: false` — dizer "desconectada" mandaria o usuário ler um QR
       * code que não resolveria nada.
       */
      return mapLineError(error, 'Falha ao ler o estado da conexão da linha')
    }
  }
}
