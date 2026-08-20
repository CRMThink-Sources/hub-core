import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ListTemplateLinesUseCase } from '@/modules/thinkzap/application/list-template-lines'

/**
 * A instalação vem do JWT e nada vem da request. Se o escopo viesse no corpo, o
 * chamador escolheria de qual instalação ler.
 */
const schema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /api/thinkzap/messages/template-lines` — as linhas que podem enviar template,
 * para a tela de configuração do robô de Bizproc.
 *
 * Vive no bloco do widget, **sem** `requireThinkzapPermission('connectors', 'read')`,
 * pelo mesmo motivo de `/messages/widget-templates/:subscriptionItemId`: quem
 * configura uma automação de Bizproc é o usuário que desenha o processo, não
 * necessariamente quem administra conectores — exigir permissão de conector faria a
 * tela abrir vazia justamente para quem ela existe para atender.
 *
 * `/connector/list` não serve aqui: exige `connectors:read`, consulta o estado ao
 * vivo de cada linha no provider, e devolve `instanceId`, `channelId`, `settings` e o
 * aparelho da Z-API — payload que a configuração de automação não usa e que esta rota
 * não deveria expor.
 */
export class TemplateLinesController extends Controller {
  constructor(private readonly useCase: ListTemplateLinesUseCase) {
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
