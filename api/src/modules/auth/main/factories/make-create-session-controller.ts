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
  console.log({ domainId, appId })
  const getDomainRepo = new PrismaDomainRepository()
  const domain = await getDomainRepo.getDomainById(domainId)
  console.log({ domain })
  const getAppRepo = new PrismaInstalledAppRepository()
  const app = await getAppRepo.getByAppCodeAndDomainId(appId, domainId)
  console.log({ app })
  const getAvailableAppRepo = new PrismaAvailableAppRepository()
  console.log({ getAvailableAppRepo })
  if (!app) {
    throw new Error('App not found')
  }
  const availableApp = await getAvailableAppRepo.getById(app?.appCodeId ?? '')

  const sessionHandler = sessionRegistry.get(availableApp.code)
  if (!sessionHandler) {
    throw new Error('Session handler not found')
  }

  return new SessionController(sessionHandler, app)
}
