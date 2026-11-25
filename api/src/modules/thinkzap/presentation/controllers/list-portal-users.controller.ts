import { httpResponse } from '@/shared/helpers/http'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { Controller } from '@/shared/presentation/controller'
import { Request, Response } from 'express'
import z from 'zod'

type BitrixUserRow = {
  ID?: string | number
  NAME?: string
  LAST_NAME?: string
  WORK_POSITION?: string
  ACTIVE?: boolean | string
}

type UserPage = { result?: BitrixUserRow[]; next?: number }

export type PortalUser = {
  id: string
  name: string
  position?: string
  /** Só na consulta por `ids`, que também traz desativados. */
  active?: boolean
}

function toPortalUser(row: BitrixUserRow): PortalUser {
  return {
    id: String(row.ID),
    name:
      [row.NAME, row.LAST_NAME].filter(Boolean).join(' ').trim() ||
      `Usuário #${row.ID}`,
    position: row.WORK_POSITION?.trim() || undefined,
  }
}

function hasId(row: BitrixUserRow): boolean {
  return row.ID !== undefined && row.ID !== null
}

/**
 * Busca de atendentes do portal pelo servidor, não por `BX24.callMethod` no browser: o
 * caminho do browser exige o script do portal carregado na página e o escopo `user` no
 * app do cliente. Mesmo motivo de `/openchannels`.
 */
export class ListPortalUsersController extends Controller {
  constructor(private readonly bitrix: BitrixClient) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const params = z
      .object({
        search: z.string().default(''),
        id: z.string().optional(),
        ids: z.string().optional(),
      })
      .parse(req.query)

    if (params.ids !== undefined) {
      const users = await this.findByIds(params.ids)
      return this.ok({ users, total: users.length })
    }

    // Por id quando o editor precisa só do nome de quem já está gravado: `NAME_SEARCH`
    // não acha por número, e varrer todas as páginas custaria requests do portal.
    const filtro = params.id
      ? { ID: params.id }
      : { ACTIVE: true, NAME_SEARCH: params.search }

    const response = await this.bitrix.callMethod<{ result?: BitrixUserRow[] }>(
      'user.get',
      filtro,
    )

    const users = (response.result ?? []).filter(hasId).map(toPortalUser)

    return this.ok({ users, total: users.length })
  }

  /**
   * Nomes de quem já está gravado (lista separada por vírgula). Sem filtrar por
   * ativo: quem foi desativado continua no grupo e precisa aparecer para ser
   * removido. O `user.get` devolve 50 por página.
   */
  private async findByIds(raw: string): Promise<PortalUser[]> {
    const ids = raw
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
    if (ids.length === 0) return []

    const rows: BitrixUserRow[] = []
    for (let start: number | undefined = 0; start !== undefined; ) {
      const page: UserPage = await this.bitrix.callMethod<UserPage>(
        'user.get',
        { FILTER: { ID: ids }, start },
      )
      rows.push(...(page.result ?? []))
      start = page.next
    }

    return rows.filter(hasId).map(row => ({
      ...toPortalUser(row),
      active: row.ACTIVE !== false && row.ACTIVE !== 'N',
    }))
  }
}
