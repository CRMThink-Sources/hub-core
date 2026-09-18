import { Request, Response } from 'express'
import z from 'zod'
import { EnqueueWidgetButtonUseCase } from '@/modules/thinkzap/application/enqueue-widget-button.use-case'
import {
  ButtonChannelNotConnectedError,
  ButtonProviderUnavailableError,
  InteractiveButtonSendNotSupportedError,
  InvalidButtonCombinationError,
  TooManyButtonsError,
  UnsupportedButtonTypeError,
} from '@/modules/thinkzap/domain/ports/button-errors'
import { mapWidgetSendError } from '@/modules/thinkzap/presentation/helpers/handle-widget-send-error'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'

/**
 * `POST /api/thinkzap/messages/send-widget-button` — envio de mensagem com
 * botões pelo widget, disponível para linha `ZAPI` e `HUBMESSAGE` — mirror de
 * `SendWidgetTemplateController`, sem a restrição a um provider único.
 *
 * **Responde `202`.** A intenção fica durável neste request; quem entrega ao
 * contato é o worker. As recusas de negócio continuam síncronas — linha
 * bloqueada, canal não conectado, tipo de botão inválido para o provider,
 * telefone inválido — e é isso que o `catch` abaixo traduz.
 */
const buttonSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('REPLY'),
  }),
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('URL'),
    url: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.literal('CALL'),
    phone: z.string().min(1),
  }),
])

const schema = z.object({
  subscriptionItemId: z.string().min(1),
  destination: z.string().min(1),
  body: z.string().min(1),
  header: z.string().optional(),
  footer: z.string().optional(),
  buttons: z.array(buttonSchema).min(1),
  entity: z.string().min(1),
  entityId: z.string().min(1),
})

export class SendWidgetButtonController extends Controller {
  constructor(
    private readonly enqueueWidgetButton: EnqueueWidgetButtonUseCase,
  ) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
      return this.badRequest(
        new Error('Invalid request: ' + parsed.error.message),
      )
    }

    try {
      const result = await this.enqueueWidgetButton.execute({
        ...parsed.data,
        domainId: (req as unknown as { domainId: string }).domainId,
        appCode: (req as unknown as { appId: string }).appId,
        operatorBitrixUserId: req.bitrixUserId,
      })
      return this.accepted(result)
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.widget_button_failed',
        { app: 'thinkzap', err: error },
        { level: 'error' },
      )

      /** Mesmo corte de indisponibilidade do template: `503`, sem `Retry-After`. */
      if (error instanceof ButtonProviderUnavailableError) {
        logThinkzapError(
          apiLogger,
          'thinkzap.message.widget_button_provider_unavailable',
          { app: 'thinkzap', err: error },
          { level: 'error' },
        )
        return {
          status: 503,
          result: { error: error.message, code: 'button-provider-unavailable' },
        }
      }

      /**
       * Tipo de botão inválido para o provider, mistura recusada pelo Z-API, ou
       * ambiente sem o adapter do provider configurado — `400` com a mensagem
       * própria: o operador precisa saber qual botão corrigir.
       */
      if (
        error instanceof UnsupportedButtonTypeError ||
        error instanceof InvalidButtonCombinationError ||
        error instanceof TooManyButtonsError ||
        error instanceof ButtonChannelNotConnectedError ||
        error instanceof InteractiveButtonSendNotSupportedError
      ) {
        return this.badRequest(error)
      }

      /**
       * O resto reusa o mapeamento do envio livre: linha bloqueada (`402`), linha
       * desconectada (`409`), item fora do escopo (`404`) e telefone inválido (`400`).
       */
      return mapWidgetSendError(error)
    }
  }
}
