import { Controller } from '@/shared/presentation/controller'
import { LoginController } from '@/modules/auth/presentation/controllers/login-controller'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { UpsertDomain } from '@/shared/application/upsert-domain'
import { JwtTokenGenerator } from '@/shared/application/jwt-token-generator'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'
import { SyncThinkzapOperatorDisplayName } from '@/modules/thinkzap/application/sync-thinkzap-operator-display-name'

export const createLoginController = (): Controller => {
  const getAvailableAppRepository = new PrismaAvailableAppRepository()
  const domainRepository = new PrismaDomainRepository()
  const upsertDomain = new UpsertDomain(domainRepository)
  const generateToken = new JwtTokenGenerator()

  /**
   * O destino do nome é o cadastro de operadores do thinkzap — o único app que
   * usa nome de operador em mensagem. A implementação ignora login de outro app
   * (não acha instalação do thinkzap para o par domínio/appCode).
   */
  const syncOperatorDisplayName = new SyncThinkzapOperatorDisplayName(
    new PrismaInstalledAppRepository(),
    new PrismaAllowedUserRepository(),
  )

  return new LoginController(
    getAvailableAppRepository,
    upsertDomain,
    generateToken,
    syncOperatorDisplayName,
  )
}
