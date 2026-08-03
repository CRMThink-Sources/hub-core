import { Controller } from '@/shared/presentation/controller'
import { Request } from 'express'
import { SessionController } from '../../presentation/controllers/session-controller'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaAvailableAppRepository } from '@/shared/infra/persistence/repositories/prisma-available-app.repository'
import { sessionRegistry } from '../../infra/setup-session-handlers'

export const makeCreateSessionController = async (
  request: Request,
): Promise<Controller> => {
  const { domainId, appId, bitrixUserId, isBitrixAdmin, bitrixDepartmentIds } =
    request
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

  /**
   * Nenhuma regra de app aqui. O acesso do thinkzap era calculado neste ponto —
   * e sem o repositório de departamentos, então quem tinha permissão só por
   * departamento aparecia como sem acesso no payload. Isso vive agora em
   * `GET /api/thinkzap/access/me` e no handler do próprio módulo.
   */
  return new SessionController(sessionHandler, {
    appId: app.id,
    appCodeId: appId,
    domainId,
    bitrixUserId,
    isBitrixAdmin: Boolean(isBitrixAdmin),
    bitrixDepartmentIds: bitrixDepartmentIds ?? [],
  })
}
