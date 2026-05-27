import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { GetBitrixUserDisplayNamePort } from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'

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

  async getDisplayName(userId: string): Promise<string | null> {
    if (!userId.trim()) {
      return null
    }

    try {
      const response = await this.bitrixClient.callMethod<{
        result?: BitrixUserGetResult
      }>('user.get', { ID: userId })

      const users = response?.result
      if (!Array.isArray(users) || users.length === 0) {
        return null
      }

      return formatBitrixUserName(users[0] ?? {})
    } catch {
      return null
    }
  }
}
