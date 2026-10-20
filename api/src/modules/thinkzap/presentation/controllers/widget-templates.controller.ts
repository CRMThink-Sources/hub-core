import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ListWidgetTemplatesUseCase } from '@/modules/thinkzap/application/list-widget-templates'
import { handleTemplateError } from './connector/list-templates.controller'

/**
 * A instalação vem do JWT, o item vem do path. Como nas demais rotas do widget, a
 * instalação **não** vem da request: se viesse, o chamador escolheria o escopo.
 */
const schema = z.object({
  subscriptionItemId: z.string().min(1),
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /api/thinkzap/messages/widget-templates/:subscriptionItemId` — templates
 * aprovados da linha, para o widget compor.
 *
 * Vive no bloco do widget, **sem** `requireThinkzapPermission('connectors',
 * 'read')`, pelo mesmo motivo de `/messages/line-status/:subscriptionItemId`: o
 * operador do contact center manda mensagem sem administrar conectores, e exigir
 * permissão de conector faria a checagem falhar exatamente para quem o widget
 * existe para atender.
 *
 * `/lines/:itemId/templates` não serve aqui: exige `connectors:read`, devolve
 * pendentes e reprovados junto, e entrega os `components` crus do provider.
 *
 * `handleTemplateError` é reusado dos controllers de template — o mapeamento dos
 * erros de domínio é o mesmo, e é ele que traduz linha Z-API e canal não conectado
 * em `400` com mensagem própria.
 */
export class WidgetTemplatesController extends Controller {
  constructor(
    private readonly useCase: ListWidgetTemplatesUseCase,
    /**
     * Se o ambiente hospeda a imagem do cabeçalho enviada como arquivo. Vai junto
     * da lista para o widget decidir se oferece "Enviar arquivo" ou só o link.
     */
    private readonly headerImageUpload = false,
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const input = schema.parse({
      subscriptionItemId: req.params.subscriptionItemId,
      domainId: req.domainId,
      appCode: req.appId,
    })

    try {
      const templates = await this.useCase.execute(input)
      return this.ok({
        templates,
        headerImageUpload: this.headerImageUpload,
      })
    } catch (error) {
      return handleTemplateError.call(this, error)
    }
  }
}
