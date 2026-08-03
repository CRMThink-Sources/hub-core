import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { resolveLineBySubscriptionItem } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { mapLineError } from '@/modules/thinkzap/presentation/helpers/handle-line-error'
import { parseLineRequest } from './line-request'

/**
 * `GET /api/thinkzap/lines/:itemId/qr-code` — QR code para pareamento.
 *
 * Só a imagem em base64 sai daqui; a credencial usada para obtê-la fica no
 * servidor.
 */
export class GetLineQrCodeController extends Controller {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly zApiClient: ZApiClient,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = parseLineRequest(req)

    try {
      const line = await resolveLineBySubscriptionItem(
        input,
        this.getAplicationContext,
      )

      /**
       * Repassado como vem do client. Apesar da tipagem `string`, o endpoint
       * `/qr-code/image` da Z-API responde `{ value: "data:image/png;base64,..." }`
       * — é esse shape que o front já consome. Envelopar de novo aqui aninharia
       * `value` dentro de `value`.
       */
      const qrCode = await this.zApiClient.getQRCode(
        line.zApiInstanceId,
        line.zApiInstanceToken,
      )

      return this.ok(qrCode)
    } catch (error) {
      return mapLineError(error, 'Falha ao gerar o QR code da linha')
    }
  }
}
