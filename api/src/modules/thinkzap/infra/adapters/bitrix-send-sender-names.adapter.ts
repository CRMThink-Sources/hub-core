import type { SendSenderNameResolver } from '@/modules/thinkzap/domain/ports/send-list-lookups.port'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'

type UserGetResponse = {
  result?: { ID?: string | number; NAME?: string; LAST_NAME?: string }[]
}

/** O `user.get` devolve até 50 usuários por chamada. */
const USER_GET_PAGE_SIZE = 50

/**
 * Nomes dos remetentes da aba Envios em um `user.get` por conjunto
 * (`FILTER: { ID: [...] }`), pelo cliente Bitrix da instalação — que já passa por
 * `bitrix-limits`. Só passa de uma chamada se houver mais de 50 ids, porque o
 * Bitrix pagina em 50 e o resto viria cortado.
 *
 * Lança quando o Bitrix recusa; o caso de uso decide tolerar.
 */
export class BitrixSendSenderNamesAdapter implements SendSenderNameResolver {
  constructor(private readonly bitrix: BitrixClient) {}

  async resolveNames(userIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>()
    for (let i = 0; i < userIds.length; i += USER_GET_PAGE_SIZE) {
      const ids = userIds.slice(i, i + USER_GET_PAGE_SIZE)
      const response = await this.bitrix.callMethod<UserGetResponse>(
        'user.get',
        { FILTER: { ID: ids } },
      )
      for (const user of response?.result ?? []) {
        const name = [user.NAME, user.LAST_NAME]
          .filter(Boolean)
          .join(' ')
          .trim()
        if (user.ID !== undefined && name) names.set(String(user.ID), name)
      }
    }
    return names
  }
}
