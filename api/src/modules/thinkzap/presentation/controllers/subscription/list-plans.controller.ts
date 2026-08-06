import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { ListOfferablePlans } from '@/modules/thinkzap/application/list-offerable-plans'

/**
 * `GET /api/thinkzap/plans` — os planos ofertáveis.
 *
 * **Não é mais filtrado pela instalação.** Era, quando uma assinatura carregava um
 * plano só: mostrar os dois conectores convidaria a escolher o mais barato para a
 * linha que usa o mais caro. Com um `line_item` por plano, a instalação pode ter os
 * dois — e o casamento entre plano e conector passou a ser verificado por linha, no
 * ato da contratação ou da criação, onde há uma linha concreta a comparar.
 *
 * Some com o filtro o `mixedProviders`: providers misturados deixaram de ser estado
 * não precificável, então não há o que sinalizar.
 *
 * Sem leitura de contexto: o catálogo ofertável não depende da instalação. A rota
 * segue autenticada e gateada por `finance:read` — o que ela devolve é preço de
 * tabela, e o escopo não muda a resposta.
 *
 * Lista vazia é resposta válida, não erro: a tela informa que não há plano
 * disponível em vez de mostrar um checkout vazio.
 */
export class ListPlansController extends Controller {
  constructor(private readonly listPlans: ListOfferablePlans) {
    super()
  }

  async perform(_req: Request): Promise<httpResponse> {
    return this.ok({ plans: await this.listPlans.execute() })
  }
}
