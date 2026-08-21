import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { countActiveLinesByProvider } from '@/modules/thinkzap/domain/line-subscription'
import { resolveCurrentContract } from '@/modules/thinkzap/domain/line-subscription'
import { ListOfferablePlans } from '@/modules/thinkzap/application/list-offerable-plans'

/** A instalação vem do JWT, nunca do corpo — mesma postura das rotas de linha. */
const schema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /api/thinkzap/plans` — os planos ofertáveis.
 *
 * **Não é filtrado pela instalação.** Era, quando uma assinatura carregava um plano
 * só: mostrar os dois conectores convidaria a escolher o mais barato para a linha que
 * usa o mais caro. Com um `line_item` por plano, a instalação pode ter os dois — e o
 * casamento entre plano e conector passou a ser verificado por linha, no ato da
 * contratação ou da criação, onde há uma linha concreta a comparar.
 *
 * Some com o filtro o `mixedProviders`: providers misturados deixaram de ser estado
 * não precificável, então não há o que sinalizar.
 *
 * **Lê o contexto para contar linhas, e isso não é filtrar.** A lista continua
 * completa; a contagem por conector entra só para o valor anunciado ser o
 * **acréscimo** de mais uma linha. Sem ela o preço mostrado seria o do primeiro
 * degrau — o mais caro em price com desconto por volume —, e o cliente desistiria por
 * um preço que não existe. Instalação nova não tem linha, e aí o acréscimo é o
 * primeiro degrau de verdade.
 *
 * Segue autenticada e gateada por `finance:read`. Lista vazia é resposta válida, não
 * erro: a tela informa que não há plano disponível em vez de mostrar um checkout
 * vazio.
 */
export class ListPlansController extends Controller {
  constructor(
    private readonly listPlans: ListOfferablePlans,
    private readonly getAplicationContext: GetAplicationContext,
  ) {
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

    const context = await this.getAplicationContext.execute(parsed.data)
    const contract = resolveCurrentContract(context.subscriptions)

    return this.ok({
      plans: await this.listPlans.execute(countActiveLinesByProvider(contract)),
    })
  }
}
