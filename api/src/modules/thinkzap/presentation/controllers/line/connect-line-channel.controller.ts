import { Request } from 'express'
import z from 'zod'

import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ConnectOfficialLine } from '@/modules/thinkzap/application/connect-official-line'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { apiLogger } from '@/shared/infra/logger'
import { parseLineRequest } from './line-request'

/**
 * `POST /api/thinkzap/lines/:itemId/connect-channel` — conclui a conexão do
 * WhatsApp Oficial de uma linha.
 *
 * O SDK `@hubmessage/connect` roda no iframe Bitrix, onde o cliente autentica a
 * própria conta Meta e obtém `wabaId`, `phoneId` e `code`; esta rota é o que o
 * front faz com eles. É o par oficial do QR code, e recusa linha bloqueada pela
 * mesma razão.
 *
 * O `channelId` **não** é aceito no corpo: sai do `metadata` do item, resolvido no
 * servidor. Aceitá-lo devolveria ao chamador a escolha do recurso, que é
 * justamente o que a família `/lines/:itemId` existe para acabar.
 */
export class ConnectLineChannelController extends Controller {
  constructor(private readonly connectOfficialLine: ConnectOfficialLine) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    const body = z
      .object({
        wabaId: z.string().min(1),
        phoneId: z.string().min(1),
        code: z.string().min(1),
      })
      .safeParse(req.body)

    /** Dado incompleto do SDK não vira chamada à HubMessage. */
    if (!body.success) {
      return this.badRequest(
        new Error('Invalid request: ' + body.error.message),
      )
    }

    try {
      const result = await this.connectOfficialLine.execute({
        ...input,
        ...body.data,
      })

      /**
       * `wabaRecorded` sai no corpo de propósito: canal conectado com WABA não
       * gravada é estado real, e a tela precisa dizer isso em vez de anunciar que a
       * linha está pronta para templates.
       */
      return this.ok({
        connected: true,
        wabaId: result.wabaId,
        wabaRecorded: result.wabaRecorded,
      })
    } catch (error) {
      if (error instanceof HubMessageApiError) {
        return this.mapProviderError(error)
      }

      /**
       * `mapLineError` já traduz linha bloqueada (`402`), provider incompatível
       * (`400`), item fora da instalação (`404`) e falha de leitura do billing
       * (`502`) — uma tradução só para toda a superfície de linha.
       */
      return mapLineError(error, 'Falha ao conectar o canal da linha')
    }
  }

  /**
   * Recusa da HubMessage separada de indisponibilidade dela.
   *
   * `4xx` é resposta sobre o que foi enviado — código expirado, WABA que não é do
   * cliente — e vira `400` com a mensagem do provider, que diz ao cliente o que
   * houve. O resto é a HubMessage fora, e vira `502`: repetir ajuda, e culpar o
   * cliente por isso descreveria errado o estado.
   */
  private mapProviderError(error: HubMessageApiError): httpResponse {
    const rejected =
      error.status !== undefined && error.status >= 400 && error.status < 500

    logThinkzapError(
      apiLogger,
      'thinkzap.hubmessage.request_failed',
      { app: 'thinkzap', status: error.status, err: error },
      {
        level: 'warn',
        msg: 'HubMessage: conexão do canal da linha falhou',
      },
    )

    if (rejected) return this.badRequest(new Error(error.message))

    return {
      status: 502,
      result: {
        error: 'Falha ao conectar o canal da linha',
        message: error.message,
      },
    }
  }
}
