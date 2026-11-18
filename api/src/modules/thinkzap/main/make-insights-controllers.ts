import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Controller } from '@/shared/presentation/controller'
import { GetInsightsStatus } from '../application/insights/get-insights-status'
import { RemoveVibecodeKey } from '../application/insights/remove-vibecode-key'
import { SaveVibecodeKey } from '../application/insights/save-vibecode-key'
import { VibecodeClient } from '../infra/clients/vibecode.client'
import { PrismaInsightsSettingsRepository } from '../infra/persistence/repositories/prisma-insights-settings.repository'
import {
  GetInsightsStatusController,
  RemoveVibecodeKeyController,
  SaveVibecodeKeyController,
} from '../presentation/controllers/insights/vibecode-key.controllers'

/** O domínio Bitrix da instalação é o que a chave Vibecode precisa casar. */
const getPortalDomain = async (appId: string): Promise<string> => {
  const app = await new PrismaInstalledAppRepository().getById(appId)
  if (!app) throw new Error('Instalação não encontrada.')
  const domain = await new PrismaDomainRepository().getDomainById(app.domainId)
  if (!domain) throw new Error('Domínio da instalação não encontrado.')
  return domain.name
}

export const makeSaveVibecodeKeyController = (): Controller =>
  new SaveVibecodeKeyController(
    new SaveVibecodeKey({
      settings: new PrismaInsightsSettingsRepository(),
      makeClient: key => new VibecodeClient(key),
      getPortalDomain,
    }),
  )

export const makeRemoveVibecodeKeyController = (): Controller =>
  new RemoveVibecodeKeyController(
    new RemoveVibecodeKey({ settings: new PrismaInsightsSettingsRepository() }),
  )

export const makeGetInsightsStatusController = (): Controller =>
  new GetInsightsStatusController(
    new GetInsightsStatus({ settings: new PrismaInsightsSettingsRepository() }),
  )
