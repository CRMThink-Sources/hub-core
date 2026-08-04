import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ListOfferablePlans } from '@/modules/thinkzap/application/list-offerable-plans'
import { resolveLineProvider } from '@/modules/thinkzap/domain/line-subscription'

/** A instalação vem do JWT: é ela que define quais planos servem. */
const schema = z.object({
  domainId: z.string().min(1),
  appCode: z.string().min(1),
})

/**
 * `GET /api/thinkzap/plans` — os planos que **esta instalação** pode contratar.
 *
 * Filtrado pelo conector que ela consome, não pelo catálogo inteiro: oficial e não
 * oficial custam diferente, e mostrar os dois convidaria o cliente a escolher o mais
 * barato para uma linha que usa o mais caro.
 *
 * Lista vazia é resposta válida, não erro: a tela informa que não há plano disponível
 * em vez de mostrar um checkout vazio.
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
    const lineProvider = resolveLineProvider(context.subscriptions)

    return this.ok({
      plans: await this.listPlans.execute(lineProvider),
      /**
       * A tela precisa distinguir "não há plano cadastrado" de "a instalação tem
       * linhas de conectores diferentes e nenhum plano cobre isso" — as duas dão
       * lista vazia, e só a segunda pede contato com o suporte.
       */
      mixedProviders: lineProvider === 'MIXED',
    })
  }
}
