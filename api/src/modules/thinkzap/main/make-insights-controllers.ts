import { enqueueInsightsCompute } from '@/queue/insights-compute.queue'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Controller } from '@/shared/presentation/controller'
import { GetInsightsConfig } from '../application/insights/get-insights-config'
import { GetInsightsDashboard } from '../application/insights/get-insights-dashboard'
import { GetInsightsToday } from '../application/insights/get-insights-today'
import { InsightsPanelReader } from '../application/insights/read-insights-panel'
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
// Importar o runtime também aponta o estado da chave Vibecode para o Redis.
import { insightsStore } from './insights-runtime'
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

// A API não calcula painel: quem lê as conversas é o worker de Insights
// (`worker:insights`). Aqui só se lê o resultado guardado e se enfileira o
// cálculo.
const panelReader = new InsightsPanelReader({
  store: insightsStore,
  enqueue: enqueueInsightsCompute,
})

// Gravar ou remover a chave troca o modo (full ↔ lean), e salvar a config muda
// o resultado de toda consulta: os resultados guardados do app caem na hora, e
// um cálculo em andamento deixa de gravar (geração do app, no Redis). O worker
// resolve a fonte a cada job, então não há fonte guardada a descartar.
export const makeSaveVibecodeKeyController = (): Controller => {
  const save = new SaveVibecodeKey({
    settings: new PrismaInsightsSettingsRepository(),
    makeClient: key => new VibecodeClient(key),
    getPortalDomain,
  })
  return new SaveVibecodeKeyController({
    execute: async (appId, key) => {
      const saved = await save.execute(appId, key)
      await insightsStore.invalidateApp(appId)
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
      await insightsStore.invalidateApp(appId)
    },
  })
}

export const makeGetInsightsStatusController = (): Controller =>
  new GetInsightsStatusController(
    new GetInsightsStatus({ settings: new PrismaInsightsSettingsRepository() }),
  )

const makeGetConfig = () =>
  new GetInsightsConfig({ settings: new PrismaInsightsSettingsRepository() })

export const makeGetInsightsDashboardController = (): Controller =>
  new GetInsightsDashboardController(
    new GetInsightsDashboard({ reader: panelReader }),
  )

export const makeGetInsightsTodayController = (): Controller =>
  new GetInsightsTodayController(new GetInsightsToday({ reader: panelReader }))

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
      await insightsStore.invalidateApp(appId)
      return saved
    },
  })
}
