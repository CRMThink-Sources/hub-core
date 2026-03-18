import { Controller } from '@/shared/presentation/controller'
import { LoginController } from '@/modules/auth/presentation/controllers/login-controller'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { GetOrCreateDomain } from '@/shared/application/get-or-create-domain'
import { JwtTokenGenerator } from '@/shared/application/jwt-token-generator'

export const createLoginController = (): Controller => {
  const getAvailableAppRepository = new PrismaAvailableAppRepository()
  const domainRepository = new PrismaDomainRepository()
  const getOrCreateDomain = new GetOrCreateDomain(
    domainRepository,
    domainRepository,
  )
  const generateToken = new JwtTokenGenerator()
  return new LoginController(
    getAvailableAppRepository,
    getOrCreateDomain,
    generateToken,
  )
}
