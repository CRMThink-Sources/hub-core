import type { PrismaThinkzapOperatorOAuthRepository } from '../infra/persistence/prisma-thinkzap-operator-oauth.repository'

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
    const expiresAt = new Date(Date.now() + input.expiresIn * 1000)

    await this.repository.upsert({
      appId: input.appId,
      bitrixUserId: input.bitrixUserId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt,
    })
  }
}
