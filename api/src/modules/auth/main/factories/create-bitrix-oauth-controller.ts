import { BitrixOAuthController } from '@/modules/auth/presentation/controllers/bitrix-oauth-controller'
import { UpsertOperatorBitrixOAuth } from '@/modules/thinkzap/application/upsert-operator-bitrix-oauth'
import { PrismaThinkzapOperatorOAuthRepository } from '@/modules/thinkzap/infra/persistence/prisma-thinkzap-operator-oauth.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'

export const createBitrixOAuthController = () => {
  const operatorOAuthRepo = new PrismaThinkzapOperatorOAuthRepository()

  return new BitrixOAuthController(
    new PrismaDomainRepository(),
    new PrismaAvailableAppRepository(),
    new PrismaInstalledAppRepository(),
    new UpsertOperatorBitrixOAuth(operatorOAuthRepo),
  )
}
