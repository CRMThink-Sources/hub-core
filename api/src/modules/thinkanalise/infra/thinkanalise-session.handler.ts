import {
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { PrismaBiConnectorRepository } from './persistence/repositories/prisma-bi-connector.repository'

export class ThinkAnaliseSessionHandler implements SessionHandler {
  appCode = 'crmthink.thinkanalise'

  handlers: SessionHanderPerformer[] = [
    {
      perform: async <T>(params: { appId: string }): Promise<T> => {
        const bitrix = (await makeBitrixClientByAppId(
          params.appId,
          'biconnector',
        )) as BitrixBiConnectorClient

        const repo = new PrismaBiConnectorRepository()
        const [bitrixConnectors, localConnectors] = await Promise.all([
          bitrix.biconnectorList(),
          repo.listBiConnectors(params.appId),
        ])

        const providerById = new Map(
          localConnectors.map(c => [c.biconnectorId, c.provider]),
        )

        const biconnectors = bitrixConnectors.map(c => ({
          ...c,
          provider: providerById.get(c.id) ?? 'asaas',
        }))

        return { key: 'biconnectors', data: biconnectors } as T
      },
    },
    {
      perform: async <T>(params: { appId: string }): Promise<T> => {
        const bitrix = (await makeBitrixClientByAppId(
          params.appId,
          'biconnector',
        )) as BitrixBiConnectorClient

        const sources = await bitrix.sourceList()

        return { key: 'sources', data: sources } as T
      },
    },
    {
      perform: async <T>(params: { appId: string }): Promise<T> => {
        const bitrix = (await makeBitrixClientByAppId(
          params.appId,
          'biconnector',
        )) as BitrixBiConnectorClient

        const list = await bitrix.datasetList()
        const datasets: typeof list = []
        for (const d of list) {
          const detail = await bitrix.datasetGet(d.id)
          datasets.push({ ...d, fields: detail.fields })
        }

        return { key: 'datasets', data: datasets } as T
      },
    },
  ]
}
