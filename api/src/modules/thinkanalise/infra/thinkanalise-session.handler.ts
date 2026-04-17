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

        const biconnectors = await bitrix.biconnectorList()

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
        const datasets = await Promise.all(
          list.map(async d => {
            const detail = await bitrix.datasetGet(d.id)
            return { ...d, fields: detail.fields }
          }),
        )

        return { key: 'datasets', data: datasets } as T
      },
    },
  ]
}
