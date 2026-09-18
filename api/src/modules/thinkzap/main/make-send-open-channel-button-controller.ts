import { ResolveOperatorBitrixAccessToken } from '@/modules/thinkzap/application/resolve-operator-bitrix-access-token'
import type { ResolveOperatorBitrixAccessToken as ResolveOperatorFn } from '../presentation/controllers/send-open-channel-button.controller'
import { PrismaThinkzapOperatorOAuthRepository } from '@/modules/thinkzap/infra/persistence/prisma-thinkzap-operator-oauth.repository'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Controller } from '@/shared/presentation/controller'
import {
  SendOpenChannelButtonController,
  createBitrixClientWithUserToken,
} from '../presentation/controllers/send-open-channel-button.controller'

const resolveOperatorBitrixAccessToken = new ResolveOperatorBitrixAccessToken(
  new PrismaDomainRepository(),
  new PrismaAvailableAppRepository(),
  new PrismaInstalledAppRepository(),
  new PrismaCredentialRepository(),
  new PrismaThinkzapOperatorOAuthRepository(),
  new BitrixOAuthClient(),
)

export const makeSendOpenChannelButtonController = (): Controller => {
  const domainRepository = new PrismaDomainRepository()
  const resolveOperator: ResolveOperatorFn = (domain, userId) =>
    resolveOperatorBitrixAccessToken.execute(domain, userId)

  return new SendOpenChannelButtonController(
    domainRepository,
    createBitrixClientWithUserToken,
    resolveOperator,
  )
}
