import { Request } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import type { ListSends } from '@/modules/thinkzap/application/list-sends'
import { InvalidSendListFilterError } from '@/modules/thinkzap/domain/errors/invalid-send-list-filter.error'
import {
  SEND_LIST_MAX_LIMIT,
  SEND_LIST_MAX_PAGE,
  normalizeSendListFilters,
} from '@/modules/thinkzap/domain/send-list-filters'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Data só com dia (`YYYY-MM-DD`) é o dia inteiro: `from` vira 00:00:00.000 e `to`
 * vira 23:59:59.999 (UTC). Sem isso o `to` de um seletor de data cairia à meia-noite
 * do início do dia e a lista perderia todos os envios do último dia escolhido.
 * Data com horário passa como veio.
 */
function toBoundary(value: string, edge: 'start' | 'end'): Date {
  const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'
  const date = new Date(DATE_ONLY.test(value) ? value + suffix : value)
  // `2026-02-31` o JS aceita e empurra para março; dia que não existe é erro.
  if (DATE_ONLY.test(value) && !date.toISOString().startsWith(value)) {
    return new Date(NaN)
  }
  return date
}

const dateParam = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine(value => !Number.isNaN(toBoundary(value, 'start').getTime()), {
    message: 'Data inválida. Envie YYYY-MM-DD ou uma data ISO 8601.',
  })

/** Só dígitos: `Number('1e3')` e `' '` passariam por coerção e escapariam do teto. */
const intParam = (field: string, max: number) =>
  z
    .string()
    .regex(/^\d{1,9}$/, `${field} deve ser um inteiro positivo.`)
    .transform(Number)
    .pipe(
      z
        .number()
        .min(1, `${field} deve ser pelo menos 1.`)
        .max(max, `${field} deve ser no máximo ${max}.`),
    )

const textParam = z.string().trim().max(200)

const querySchema = z.object({
  from: dateParam.optional(),
  to: dateParam.optional(),
  status: textParam.optional(),
  line: textParam.optional(),
  destination: textParam.optional(),
  senderId: textParam.optional(),
  page: intParam('page', SEND_LIST_MAX_PAGE).optional(),
  limit: intParam('limit', SEND_LIST_MAX_LIMIT).optional(),
})

/**
 * `GET /api/thinkzap/messages/sends` — a lista da aba Envios.
 *
 * A identidade (instalação, app, usuário e se é administrador) vem só do token:
 * nada disso é lido de query ou body, então `senderId`/`domainId` na URL de quem
 * não é administrador não ampliam o que ele vê. Nada é logado aqui: telefone e
 * texto de mensagem não podem ir para log.
 */
export class ListSendsController extends Controller {
  constructor(
    private readonly listSends: Pick<ListSends, 'execute'>,
    private readonly now: () => Date = () => new Date(),
  ) {
    super()
  }

  async perform(req: Request): Promise<httpResponse> {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.'),
      )
    }
    const { domainId, appId, bitrixUserId } = req
    const isAdmin = req.thinkzapAccess?.canManageAccess === true
    // Sem o usuário do token o escopo do não administrador não existe; recusar é
    // mais seguro que listar sem filtro de remetente.
    if (!domainId || !appId || (!bitrixUserId && !isAdmin)) {
      return this.unauthorized(new Error('Identidade do usuário ausente.'))
    }

    const query = parsed.data
    try {
      const filters = normalizeSendListFilters(
        {
          from: query.from ? toBoundary(query.from, 'start') : null,
          to: query.to ? toBoundary(query.to, 'end') : null,
          status: query.status,
          line: query.line,
          destination: query.destination,
          senderId: query.senderId,
          page: query.page,
          limit: query.limit,
        },
        this.now(),
      )
      const output = await this.listSends.execute({
        filters,
        domainId,
        appCode: appId,
        bitrixUserId: bitrixUserId ?? '',
        isAdmin,
      })
      return this.ok(output)
    } catch (error) {
      if (error instanceof InvalidSendListFilterError) {
        return this.badRequest(error)
      }
      throw error
    }
  }
}
