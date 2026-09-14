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
}

export type PortalUser = { id: string; name: string; position?: string }

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
      .object({ search: z.string().default(''), id: z.string().optional() })
      .parse(req.query)

    // Por id quando o editor precisa só do nome de quem já está gravado: `NAME_SEARCH`
    // não acha por número, e varrer todas as páginas custaria requests do portal.
    const filtro = params.id
      ? { ID: params.id }
      : { ACTIVE: true, NAME_SEARCH: params.search }

    const response = await this.bitrix.callMethod<{ result?: BitrixUserRow[] }>(
      'user.get',
      filtro,
    )

    const users: PortalUser[] = (response.result ?? [])
      .filter(row => row.ID !== undefined && row.ID !== null)
      .map(row => ({
        id: String(row.ID),
        name:
          [row.NAME, row.LAST_NAME].filter(Boolean).join(' ').trim() ||
          `Usuário #${row.ID}`,
        position: row.WORK_POSITION?.trim() || undefined,
      }))

    return this.ok({ users, total: users.length })
  }
}
