import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { SessionController } from '../../presentation/controllers/session-controller'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { sessionRegistry } from '../../infra/setup-session-handlers'

export const makeCreateSessionController = async (
  request: Request,
): Promise<Controller> => {
  const { domainId, appId } = request
  if (!domainId || !appId) {
    throw new Error('Domain ID and app ID are required')
  }
  const getAppRepo = new PrismaInstalledAppRepository()
  const app = await getAppRepo.getByAppCodeAndDomainId(appId, domainId)
  const getAvailableAppRepo = new PrismaAvailableAppRepository()
  if (!app) {
    throw new Error('App not found')
  }
  const availableApp = await getAvailableAppRepo.getById(appId)

  const sessionHandler = sessionRegistry.get(availableApp.id)
  if (!sessionHandler) {
    throw new Error('Session handler not found')
  }

  return new SessionController(sessionHandler, app)
}
