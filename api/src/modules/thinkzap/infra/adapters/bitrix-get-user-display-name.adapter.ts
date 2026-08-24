import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import {
  BitrixUserDisplayNameLookup,
  GetBitrixUserDisplayNamePort,
} from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'
import { logThinkzapError } from '../../errors/catalog'

const log = createWorkerSourceLogger('bitrix')

type BitrixUserGetResult = Array<{
  NAME?: string
  LAST_NAME?: string
}>

function formatBitrixUserName(user: {
  NAME?: string
  LAST_NAME?: string
}): string | null {
  const name = [user.NAME, user.LAST_NAME].filter(Boolean).join(' ').trim()
  return name || null
}

export class BitrixGetUserDisplayNameAdapter implements GetBitrixUserDisplayNamePort {
  constructor(private readonly bitrixClient: BitrixClient) {}

  async getDisplayName(userId: string): Promise<BitrixUserDisplayNameLookup> {
    if (!userId.trim()) {
      return { name: null }
    }

    try {
      const response = await this.bitrixClient.callMethod<{
        result?: BitrixUserGetResult
      }>('user.get', { ID: userId })

      const users = response?.result
      if (!Array.isArray(users) || users.length === 0) {
        return { name: null }
      }

      return { name: formatBitrixUserName(users[0] ?? {}) }
    } catch (err) {
      /**
       * A mensagem da recusa é o que interessa: `BitrixError` traz status e corpo,
       * e é ali que aparece o escopo `user`/`user_brief` faltando na instalação. Ela
       * volta no `refusal` para caber na mesma linha de log de quem decidiu prefixar
       * — sem isso o operador vê "nome não resolvido" sem saber onde mexer.
       */
      const refusal = err instanceof Error ? err.message : String(err)

      logThinkzapError(
        log,
        'thinkzap.bitrix.user_name_failed',
        { userId, refusal, err },
        { level: 'warn' },
      )

      return { name: null, refusal }
    }
  }
}
