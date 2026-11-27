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
  /**
   * Aceita o cliente pronto ou uma fábrica: a fábrica só roda quando há ids a
   * resolver, e falha dela (instalação/credencial ausente) deixa os nomes em
   * branco em vez de derrubar a lista (os nomes são melhor esforço).
   */
  constructor(
    private readonly bitrix: BitrixClient | (() => Promise<BitrixClient>),
  ) {}

  async resolveNames(userIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>()
    if (userIds.length === 0) return names
    let bitrix: BitrixClient
    try {
      bitrix =
        typeof this.bitrix === 'function' ? await this.bitrix() : this.bitrix
    } catch {
      return names
    }
    for (let i = 0; i < userIds.length; i += USER_GET_PAGE_SIZE) {
      const ids = userIds.slice(i, i + USER_GET_PAGE_SIZE)
      const response = await bitrix.callMethod<UserGetResponse>('user.get', {
        FILTER: { ID: ids },
      })
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
