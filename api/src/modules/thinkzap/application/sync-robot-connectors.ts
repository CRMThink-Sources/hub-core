import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { Instance } from '@/modules/thinkzap/domain/entities/instance'
import { hubMessageConnectorLabel } from '@/modules/thinkzap/domain/hubmessage-connector-label'
import { PrismaConnectorRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-connector.repository'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { ZApiClient } from '../infra/clients/z-api.client'
import { buildThinkzapRobotUpdateParams } from './build-thinkzap-robot-add-params'
import type { Connector } from '../domain/entities/connector'

function labelFromInstanceName(name: string | undefined): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) return null

  return name.split(' | ')[1] ?? name
}

// Falha na leitura da Z-API degrada para o nome do item em vez de derrubar o sync.
async function lineLabel(
  item: SubscriptionItem,
  zApiClient: ZApiClient,
): Promise<string> {
  if (item.metadata.provider !== 'ZAPI') return item.name

  try {
    const remote = await zApiClient.getInstance(
      item.metadata.zApiInstanceId,
      item.metadata.zApiInstanceToken,
    )

    return labelFromInstanceName(remote?.name) ?? item.name
  } catch (error) {
    logThinkzapError(
      apiLogger,
      'thinkzap.zapi.instance_get_failed',
      { app: 'thinkzap', err: error, subscriptionItemId: item.id },
      { msg: 'failed to read z-api instance name while syncing robot options' },
    )

    return item.name
  }
}

export async function syncThinkzapRobotConnectorOptions(
  appId: string,
): Promise<void> {
  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  // Chave = id do item: tem que bater com o que `BitrixRobotWebhookHandlerController` resolve.
  const installedApp = await new PrismaInstalledAppRepository().getById(appId)
  if (!installedApp) return

  const context = await makeGetAplicationContext().execute({
    domainId: installedApp.domainId,
    appCode: installedApp.appCodeId,
  })

  const options: Record<string, string> = {}

  for (const item of context.subscriptions.flatMap(
    subscription => subscription.items,
  )) {
    if (item.metadata.provider === 'NONE') continue
    options[item.id] = await lineLabel(item, zApiClient)
  }

  try {
    const bitrixClient = (await makeBitrixClientByAppId(appId)) as BitrixClient

    const params = buildThinkzapRobotUpdateParams()
    params.FIELDS.PROPERTIES.connector.Options = options

    await bitrixClient.callMethod('bizproc.robot.update', params)
  } catch (error) {
    apiLogger.warn(
      { app: 'thinkzap', err: error, appId },
      'failed to sync robot connector options',
    )
  }
}
