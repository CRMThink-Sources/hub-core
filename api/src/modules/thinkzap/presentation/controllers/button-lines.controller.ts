import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ListButtonLinesUseCase } from '@/modules/thinkzap/application/list-button-lines'

const schema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /api/thinkzap/messages/button-lines/official` e `/button-lines/unofficial`
 * — as linhas que podem enviar botão pelo provider daquele robô, para a tela
 * de configuração. Mirror de `TemplateLinesController`, inclusive o mesmo
 * motivo de viver sem `requireThinkzapPermission('connectors', 'read')`.
 */
export class ButtonLinesController extends Controller {
  constructor(private readonly useCase: ListButtonLinesUseCase) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const parsed = schema.safeParse({
      domainId: req.domainId,
      appCode: req.appId,
    })

    if (!parsed.success) {
      return this.badRequest(new Error('Instalação ausente no token'))
    }

    const lines = await this.useCase.execute(parsed.data)

    return this.ok({ lines })
  }
}
