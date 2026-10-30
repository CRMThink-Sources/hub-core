import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { ListPublishedProductUpdates } from '../../application/list-published-product-updates'

/**
 * `GET /api/thinkzap/novidades?locale=<pt|en|es>` — a aba Novidades do ThinkZap.
 *
 * Montado nas rotas do ThinkZap (JWT do `authMiddleware` + acesso ao app), sem
 * permissão específica: todo usuário do ThinkZap vê. A lista é a mesma para todos
 * os clientes, então a instalação do JWT não entra na consulta. `locale` ausente,
 * repetido ou inválido vira `pt`.
 */
export class ListPublishedProductUpdatesController extends Controller {
  constructor(private readonly listPublished: ListPublishedProductUpdates) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const { locale } = req.query
    return this.ok(
      await this.listPublished.execute(
        typeof locale === 'string' ? locale : undefined,
      ),
    )
  }
}
