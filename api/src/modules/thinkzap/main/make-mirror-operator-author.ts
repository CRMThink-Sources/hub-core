import { ResolveOperatorBitrixAccessToken } from '@/modules/thinkzap/application/resolve-operator-bitrix-access-token'
import type { MirrorOperatorAuthor } from '@/modules/thinkzap/application/mirror-operator-author'
import { MirroredMessageReservations } from '@/modules/thinkzap/infra/cache/mirrored-message-reservations'
import { PrismaThinkzapOperatorOAuthRepository } from '@/modules/thinkzap/infra/persistence/prisma-thinkzap-operator-oauth.repository'
import { redisConnection } from '@/queue/redis-connection'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export function makeMirrorOperatorAuthor(): MirrorOperatorAuthor {
  const resolveOperatorAccessToken = new ResolveOperatorBitrixAccessToken(
    new PrismaDomainRepository(),
    new PrismaAvailableAppRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaCredentialRepository(),
    new PrismaThinkzapOperatorOAuthRepository(),
    new BitrixOAuthClient(),
  )

  return {
    resolveAccessToken: (domain, bitrixUserId) =>
      resolveOperatorAccessToken.execute(domain, bitrixUserId),
    createClient: (domain, accessToken) =>
      BitrixClient.withUserToken(domain, accessToken),
    reservations: new MirroredMessageReservations(redisConnection),
  }
}
