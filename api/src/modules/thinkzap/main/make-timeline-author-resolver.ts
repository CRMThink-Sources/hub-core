import { ResolveOperatorBitrixAccessToken } from '@/modules/thinkzap/application/resolve-operator-bitrix-access-token'
import { PrismaThinkzapOperatorOAuthRepository } from '@/modules/thinkzap/infra/persistence/prisma-thinkzap-operator-oauth.repository'
import type { TimelineAuthorResolver } from '@/shared/application/send-bitrix-notificatio.service'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

/**
 * Resolve o cliente do Bitrix que age **como o remetente**, para o comentário de
 * timeline sair com o nome e a foto dele. Mesmo token (`ThinkzapOperatorOAuth`, com
 * renovação) que o espelhamento usa para postar como o operador.
 *
 * `null` quando o usuário nunca autorizou o app: o serviço cai na credencial da
 * instalação.
 */
export function makeTimelineAuthorResolver(
  domainName: string,
): TimelineAuthorResolver {
  const resolveToken = new ResolveOperatorBitrixAccessToken(
    new PrismaDomainRepository(),
    new PrismaAvailableAppRepository(),
    new PrismaInstalledAppRepository(),
    new PrismaCredentialRepository(),
    new PrismaThinkzapOperatorOAuthRepository(),
    new BitrixOAuthClient(),
  )

  return async bitrixUserId => {
    const accessToken = await resolveToken.execute(domainName, bitrixUserId)
    if (!accessToken) return null
    return BitrixClient.withUserToken(domainName, accessToken)
  }
}
