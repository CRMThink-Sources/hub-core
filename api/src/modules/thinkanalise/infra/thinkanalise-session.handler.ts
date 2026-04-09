import { env } from '@/config/env'
import {
  SessionHanderPerformer,
  SessionHandler,
} from '@/modules/auth/infra/session-registry'
import { BitrixBiConnectorClient } from '@/shared/infra/clients/bitrix-biconnector.client'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import {
  makeBitrixClient,
  makeBitrixClientByAppId,
} from '@/shared/main/make-bitrix-client'

export class ThinkAnaliseSessionHandler implements SessionHandler {
  appCode = env.appCodes.thinkanalise

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
  ]
}
