import type { PrismaThinkzapOperatorOAuthRepository } from '../infra/persistence/prisma-thinkzap-operator-oauth.repository'
import { resolveBitrixTokenExpiresAt } from './resolve-bitrix-token-expires-at'

export type UpsertOperatorBitrixOAuthInput = {
  appId: string
  bitrixUserId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export class UpsertOperatorBitrixOAuth {
  constructor(
    private readonly repository: PrismaThinkzapOperatorOAuthRepository,
  ) {}

  async execute(input: UpsertOperatorBitrixOAuthInput): Promise<void> {
    const expiresAt = resolveBitrixTokenExpiresAt(input.expiresIn)

    await this.repository.upsert({
      appId: input.appId,
      bitrixUserId: input.bitrixUserId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt,
    })
  }
}
