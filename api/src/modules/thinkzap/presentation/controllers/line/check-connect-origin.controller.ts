import { Request } from 'express'
import z from 'zod'

import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { CheckConnectOrigin } from '@/modules/thinkzap/application/check-connect-origin'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/** Aceita só origem http(s) e devolve `protocolo://host[:porta]`, sem caminho. */
const originSchema = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('protocolo inválido')
      }
      return url.origin
    } catch {
      ctx.addIssue({ code: 'custom', message: 'origin inválida' })
      return z.NEVER
    }
  })

/**
 * `GET /api/thinkzap/lines/:itemId/connect-origin-check?origin=` — diz se a origem da
 * página está liberada para o SDK de conexão do canal oficial da linha.
 *
 * O `channelId` sai do `metadata` do item no servidor, nunca do chamador. A origem vem
 * em query porque, atrás do iframe Bitrix e de proxies, o header `Origin` não é
 * confiável; ela só orienta a mensagem da tela, a allowlist real é da Omni.
 */
export class CheckConnectOriginController extends Controller {
  constructor(private readonly checkConnectOrigin: CheckConnectOrigin) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    const query = z.object({ origin: originSchema }).safeParse(req.query)

    if (!query.success) {
      return this.badRequest(
        new Error('Invalid request: ' + query.error.message),
      )
    }

    try {
      const result = await this.checkConnectOrigin.execute({
        ...input,
        origin: query.data.origin,
      })

      return this.ok({ allowed: result.allowed })
    } catch (error) {
      return mapLineError(error, 'Falha ao checar a origem da conexão')
    }
  }
}
