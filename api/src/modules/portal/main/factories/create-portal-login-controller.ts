import { Controller } from '@/shared/presentation/controller'
import { JwtTokenGenerator } from '@/shared/application/jwt-token-generator'
import { LoginPortalUser } from '../../application/login-portal-user'
import { PortalLoginController } from '../../presentation/controllers/login-controller'
import { PrismaPortalUserRepository } from '../../infra/persistence/prisma-portal-user.repository'

export const createPortalLoginController = (): Controller => {
  const portalUserRepository = new PrismaPortalUserRepository()
  const generateToken = new JwtTokenGenerator()
  const loginPortalUser = new LoginPortalUser(
    portalUserRepository,
    generateToken,
  )

  return new PortalLoginController(loginPortalUser)
}
