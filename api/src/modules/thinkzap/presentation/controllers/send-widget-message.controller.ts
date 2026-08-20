import { EnqueueWidgetMessageUseCase } from '@/modules/thinkzap/application/enqueue-widget-message.use-case'
import { mapWidgetSendError } from '@/modules/thinkzap/presentation/helpers/handle-widget-send-error'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

const attachmentSchema = z.object({
  kind: z.enum(['image', 'video', 'audio', 'file']),
  content: z.string().min(1),
  name: z.string().optional(),
})

/**
 * `202` e não `200`: a mensagem fica **durável** neste request, mas quem a entrega ao
 * contato é o worker. Responder `200 { message: 'Message sent successfully' }`, como
 * antes, afirmaria uma entrega que ainda não aconteceu.
 *
 * As recusas de negócio continuam síncronas — linha bloqueada, desconectada, telefone
 * inválido —, então o que o operador vê na tela no momento do clique não perdeu nada:
 * ou o erro que ele consegue consertar, ou a confirmação de que a mensagem não se
 * perde mais.
 */
export class SendWidgetMessageController extends Controller {
  constructor(
    private readonly enqueueWidgetMessage: EnqueueWidgetMessageUseCase,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = z
      .object({
        subscriptionItemId: z.string().min(1),
        destination: z.string().min(1),
        message: z.string().trim().min(1).optional(),
        attachments: z.array(attachmentSchema).optional(),
        entity: z.string().min(1),
        entityId: z.string().min(1),
      })
      .safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    /**
     * Anexo não passa por esta rota enquanto a Fase 3 não decide onde o binário mora
     * entre a API e o worker (containers separados, sem volume compartilhado). Recusar
     * é melhor que aceitar e descartar em silêncio.
     */
    if (parsed.data.attachments?.length) {
      return this.badRequest(
        new Error('Attachments must be sent through the multipart endpoint'),
      )
    }

    try {
      const result = await this.enqueueWidgetMessage.execute({
        ...parsed.data,
        domainId: (req as unknown as { domainId: string }).domainId,
        appCode: (req as unknown as { appId: string }).appId,
      })
      return this.accepted(result)
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_send_failed',
        { app: 'thinkzap', err: error },
        { level: 'error' },
      )
      return mapWidgetSendError(error)
    }
  }
}
