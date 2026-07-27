import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { Instance } from '@/modules/thinkzap/domain/entities/instance'
import { hubMessageConnectorLabel } from '@/modules/thinkzap/domain/hubmessage-connector-label'
import { PrismaConnectorRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-connector.repository'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { logger } from '@/shared/infra/logger'
import { ZApiClient } from '../infra/clients/z-api.client'
import { buildThinkzapRobotUpdateParams } from './build-thinkzap-robot-add-params'
import type { Connector } from '../domain/entities/connector'

function connectorLabelFromInstanceName(
  name: string | undefined,
): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) return null

  return name.split(' | ')[1] ?? name
}

async function resolveInstanceName(
  zApiClient: ZApiClient,
  connector: Connector,
): Promise<string | undefined> {
  if (!connector.instance) return undefined

  try {
    const instance = await zApiClient.getInstance(
      connector.instance.instanceId,
      connector.instance.zApiToken ?? '',
    )

    return instance?.name
  } catch (error) {
    logger.warn(
      { err: error, connectorId: connector.id },
      '[thinkzap] failed to read z-api instance name while syncing robot options',
    )

    return undefined
  }
}

/**
 * Rótulo do conector no robô. Só Z-API tem nome remoto consultável — a HubMessage
 * não expõe leitura de canal, então o rótulo sai do que está persistido.
 */
async function connectorLabel(
  connector: Connector,
  instance: Instance,
  zApiClient: ZApiClient,
): Promise<string> {
  if (connector.provider === ConnectorProvider.HUBMESSAGE) {
    return hubMessageConnectorLabel(instance)
  }

  const instanceName = await resolveInstanceName(zApiClient, connector)

  return (
    connectorLabelFromInstanceName(instanceName) ??
    instance.phoneNumber ??
    instance.instanceId
  )
}

export async function syncThinkzapRobotConnectorOptions(
  appId: string,
): Promise<void> {
  const connectorRepo = new PrismaConnectorRepository()
  const connectors = await connectorRepo.listConnectors(appId, true)
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  const options: Record<string, string> = {}

  for (const connector of connectors) {
    if (!connector.instance) continue
    if (!connector.instanceId) continue

    options[connector.id] = await connectorLabel(
      connector,
      connector.instance,
      zApiClient,
    )
  }

  try {
    const bitrixClient = (await makeBitrixClientByAppId(appId)) as BitrixClient

    const params = buildThinkzapRobotUpdateParams()
    params.FIELDS.PROPERTIES.connector.Options = options

    console.log('params', params.FIELDS.PROPERTIES)
    console.log('options', options)

    await bitrixClient.callMethod('bizproc.robot.update', params)
  } catch (error) {
    console.warn(
      `[thinkzap] failed to sync robot connector options for app ${appId}`,
      error,
    )
  }
}
