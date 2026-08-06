import { Request, Response } from 'express'
import z from 'zod'
import { SendWidgetTemplateUseCase } from '@/modules/thinkzap/application/send-widget-template.use-case'
import {
  ChannelNotConnectedError,
  ConnectorNotTemplateCapableError,
  TemplateProviderUnavailableError,
  TemplateSendNotSupportedError,
  TemplatesNotSupportedError,
} from '@/modules/thinkzap/domain/ports/template-errors'
import { mapWidgetSendError } from '@/modules/thinkzap/presentation/helpers/handle-widget-send-error'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'

/**
 * `POST /api/thinkzap/messages/send-widget-template` — envio de template pelo
 * widget, o caminho da linha do WhatsApp Oficial.
 *
 * `bodyParameters` aceita string vazia por item: a validação de "todas as variáveis
 * preenchidas" é do front, e recusar aqui por conteúdo vazio devolveria erro de
 * schema onde o front já sabe mostrar aviso melhor. O que este schema garante é
 * forma.
 */
const schema = z.object({
  subscriptionItemId: z.string().min(1),
  destination: z.string().min(1),
  templateName: z.string().min(1),
  language: z.string().min(1),
  bodyParameters: z.array(z.string()).default([]),
  templateBody: z.string().default(''),
  entity: z.string().min(1),
  entityId: z.string().min(1),
})

export class SendWidgetTemplateController extends Controller {
  constructor(private readonly sendWidgetTemplate: SendWidgetTemplateUseCase) {
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
      const result = await this.sendWidgetTemplate.execute({
        ...parsed.data,
        domainId: (req as unknown as { domainId: string }).domainId,
        appCode: (req as unknown as { appId: string }).appId,
      })
      return this.ok(result)
    } catch (error) {
      /**
       * `503` e não `400`: a requisição estava correta e o provider é que está fora.
       * `400` aqui mandaria o operador revisar dados que não têm problema, e ainda
       * poluiria a métrica de erro do cliente com indisponibilidade de terceiro.
       *
       * `Retry-After` não vai: a HubMessage não informa janela de recuperação, e um
       * valor inventado é pior que nenhum.
       */
      if (error instanceof TemplateProviderUnavailableError) {
        return {
          status: 503,
          result: {
            error: error.message,
            code: 'template-provider-unavailable',
          },
        }
      }

      /**
       * Os erros de capacidade de template não passam por `mapWidgetSendError` — ele
       * conhece `LineProviderNotSupportedError`, que é o vocabulário do envio livre.
       * `400` com a mensagem própria de cada um: linha Z-API, canal não conectado e
       * provider sem envio de template pedem ações diferentes do cliente.
       */
      if (
        error instanceof ConnectorNotTemplateCapableError ||
        error instanceof ChannelNotConnectedError ||
        error instanceof TemplateSendNotSupportedError ||
        error instanceof TemplatesNotSupportedError
      ) {
        return this.badRequest(error)
      }

      /**
       * O resto reusa o mapeamento do envio livre: linha bloqueada (`402` com
       * `code: 'line-blocked'`), item fora do escopo (`404`) e falha do provider
       * (`400` com a mensagem crua, que é o que o front já sabe exibir).
       */
      return mapWidgetSendError(error)
    }
  }
}
