import { env } from '@/config/env'

import {
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { PrismaConnectorRepository } from './persistence/repositories/prisma-connector.repository'

export class ThinkzapSessionHandler implements SessionHandler {
  appCode = env.appCodes.thinkzap

  handlers: SessionHanderPerformer[] = [
    {
      perform: async <T>(params: { appId: string }): Promise<T> => {
        const connectorRepository = new PrismaConnectorRepository()
        const connectors = await connectorRepository.listConnectors(
          params.appId,
        )
        return { key: 'connectors', data: connectors } as T
      },
    },
  ]
}
