import { env } from '@/config/env'
import { PrismaConnectorRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-connector.repository'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ZApiClient } from '../infra/clients/z-api.client'

export async function syncThinkzapRobotConnectorOptions(
  appId: string,
): Promise<void> {
  const connectorRepo = new PrismaConnectorRepository()
  const connectors = await connectorRepo.listConnectors(appId, true)
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  const options: Record<string, string> = {}

  for (const connector of connectors) {
    if (!connector.instance) continue

    const instance = await zApiClient.getInstance(
      connector.instance.instanceId,
      connector.instance.zApiToken ?? '',
    )

    if (!instance) continue
    if (!connector.instanceId) continue

    const connectorName = instance.name.split(' | ')[1] ?? instance.name
    options[connector.id] = connectorName
  }

  try {
    const bitrixClient = (await makeBitrixClientByAppId(appId)) as BitrixClient

    const params = {
      CODE: env.bitrix.robot.code,
      FIELDS: {
        PROPERTIES: {
          connector: {
            Name: 'Connector',
            Type: 'select',
            Options: options,
          },
          destination: {
            Name: 'Destination',
            Type: 'string',
          },
          message: {
            Name: 'Message',
            Type: 'text',
          },
        },
        FILTER: {
          INCLUDE: [
            ['crm', 'CCrmDocumentDeal'],
            ['crm', 'CCrmDocumentLead'],
            ['crm', 'CCrmDocumentCompany'],
            ['crm', 'CCrmDocumentContact'],
          ],
        },
      },
    }

    console.log('params', params)
    console.log('options', options)

    await bitrixClient.callMethod('bizproc.robot.update', params)
  } catch (error) {
    console.warn(
      `[thinkzap] failed to sync robot connector options for app ${appId}`,
      error,
    )
  }
}
