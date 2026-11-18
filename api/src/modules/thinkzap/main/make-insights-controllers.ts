import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Controller } from '@/shared/presentation/controller'
import { GetInsightsConfig } from '../application/insights/get-insights-config'
import { GetInsightsDashboard } from '../application/insights/get-insights-dashboard'
import { GetInsightsToday } from '../application/insights/get-insights-today'
import { invalidateInsightsCache } from '../application/insights/insights-result-cache'
import { SaveInsightsConfig } from '../application/insights/save-insights-config'
import { GetInsightsStatus } from '../application/insights/get-insights-status'
import { RemoveVibecodeKey } from '../application/insights/remove-vibecode-key'
import { SaveVibecodeKey } from '../application/insights/save-vibecode-key'
import { VibecodeClient } from '../infra/clients/vibecode.client'
import { PrismaInsightsSettingsRepository } from '../infra/persistence/repositories/prisma-insights-settings.repository'
import {
  GetInsightsConfigController,
  GetInsightsDashboardController,
  GetInsightsTodayController,
  SaveInsightsConfigController,
} from '../presentation/controllers/insights/insights.controllers'
import { makeInsightsSourceResolver } from './make-insights-source-resolver'
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

// Um resolver só para o processo: ele guarda a fonte (e o cache de conversas)
// de cada app. Um por requisição jogaria o cache fora.
const insightsSources = makeInsightsSourceResolver()

// Gravar ou remover a chave troca o modo (full ↔ lean): a fonte guardada e o
// painel em cache do modo anterior precisam cair na hora.
export const makeSaveVibecodeKeyController = (): Controller => {
  const save = new SaveVibecodeKey({
    settings: new PrismaInsightsSettingsRepository(),
    makeClient: key => new VibecodeClient(key),
    getPortalDomain,
  })
  return new SaveVibecodeKeyController({
    execute: async (appId, key) => {
      const saved = await save.execute(appId, key)
      insightsSources.invalidate(appId)
      return saved
    },
  })
}

export const makeRemoveVibecodeKeyController = (): Controller => {
  const remove = new RemoveVibecodeKey({
    settings: new PrismaInsightsSettingsRepository(),
  })
  return new RemoveVibecodeKeyController({
    execute: async appId => {
      await remove.execute(appId)
      insightsSources.invalidate(appId)
    },
  })
}

export const makeGetInsightsStatusController = (): Controller =>
  new GetInsightsStatusController(
    new GetInsightsStatus({ settings: new PrismaInsightsSettingsRepository() }),
  )

// Chave revogada no meio da leitura: o resolver marca o problema e a
// requisição é refeita pelo REST clássico.
const sourceDeps = {
  resolveSource: insightsSources.resolve,
  onSourceFailure: insightsSources.onSourceFailure,
}

const makeGetConfig = () =>
  new GetInsightsConfig({ settings: new PrismaInsightsSettingsRepository() })

export const makeGetInsightsDashboardController = (): Controller =>
  new GetInsightsDashboardController(
    new GetInsightsDashboard({ getConfig: makeGetConfig(), ...sourceDeps }),
  )

export const makeGetInsightsTodayController = (): Controller =>
  new GetInsightsTodayController(
    new GetInsightsToday({ getConfig: makeGetConfig(), ...sourceDeps }),
  )

export const makeGetInsightsConfigController = (): Controller =>
  new GetInsightsConfigController(makeGetConfig())

export const makeSaveInsightsConfigController = (): Controller => {
  const save = new SaveInsightsConfig({
    settings: new PrismaInsightsSettingsRepository(),
  })
  return new SaveInsightsConfigController({
    // A config muda o resultado de toda consulta: sem limpar, o admin salvaria
    // e continuaria vendo o painel antigo por até 5 min.
    execute: async (appId, patch) => {
      const saved = await save.execute(appId, patch)
      invalidateInsightsCache(appId)
      return saved
    },
  })
}
