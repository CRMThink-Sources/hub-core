import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { SessionController } from '../../presentation/controllers/session-controller'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { sessionRegistry } from '../../infra/setup-session-handlers'
import {
  checkThinkzapAccess,
  DENIED_THINKZAP_ACCESS,
} from '@/modules/thinkzap/application/check-thinkzap-access'
import { PrismaAllowedUserRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-allowed-user.repository'

export const makeCreateSessionController = async (
  request: Request,
): Promise<Controller> => {
  const { domainId, appId, bitrixUserId, isBitrixAdmin } = request
  if (!domainId || !appId || !bitrixUserId) {
    throw new Error('Domain ID, app ID and Bitrix user ID are required')
  }
  const getAppRepo = new PrismaInstalledAppRepository()
  const app = await getAppRepo.getByAppCodeAndDomainId(appId, domainId)
  const getAvailableAppRepo = new PrismaAvailableAppRepository()
  if (!app) {
    throw new Error('App not found')
  }
  const availableApp = await getAvailableAppRepo.getById(appId)

  const sessionHandler =
    sessionRegistry.get(availableApp.code) ??
    sessionRegistry.get(availableApp.id)
  if (!sessionHandler) {
    throw new Error('Session handler not found')
  }

  let thinkzapAccess
  if (sessionHandler.appCode === 'crmthink.thinkzap') {
    thinkzapAccess =
      (await checkThinkzapAccess(new PrismaAllowedUserRepository(), {
        installedAppId: app.id,
        bitrixUserId,
        isBitrixAdmin: Boolean(isBitrixAdmin),
      })) ?? DENIED_THINKZAP_ACCESS
  }

  return new SessionController(sessionHandler, app, thinkzapAccess)
}
