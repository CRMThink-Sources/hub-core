import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

export type BitrixActiveUser = { id: number; name: string }

type UserGetResponse = {
  result?: { ID?: string; NAME?: string; LAST_NAME?: string }[]
  next?: number
}

// Teto de páginas (50/página) — evita laço infinito se a API parar de mandar `next`.
const MAX_PAGES = 200

/**
 * Lista usuários do Bitrix24. Público (qualquer app pode reusar).
 * user.get já exclui bots/email/Open Channels/Replica/integradores.
 */
export class BitrixUserService {
  constructor(private readonly bitrix: BitrixClient) {}

  /** Usuários ativos (não-demitidos), funcionários. Paginado via `start`/`next`. */
  async listActiveUsers(): Promise<BitrixActiveUser[]> {
    const users: BitrixActiveUser[] = []
    let start: number | undefined = 0

    for (let page = 0; page < MAX_PAGES && start !== undefined; page++) {
      const data: UserGetResponse =
        await this.bitrix.callMethod<UserGetResponse>('user.get', {
          FILTER: { ACTIVE: true, USER_TYPE: 'employee' },
          start,
        })
      for (const u of data.result ?? []) {
        const id = Number(u.ID)
        if (!id) continue
        const name = [u.NAME, u.LAST_NAME].filter(Boolean).join(' ').trim()
        users.push({ id, name: name || `#${id}` })
      }
      start = typeof data.next === 'number' ? data.next : undefined
    }

    return users
  }
}
