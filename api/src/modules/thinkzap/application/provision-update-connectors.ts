import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ListConnectorsRepository } from '@/modules/thinkzap/domain/repositories/list-connectors'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { UpdateConnectorRepository } from '@/modules/thinkzap/domain/repositories/update-connector.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { syncThinkzapRobotConnectorOptions } from './sync-robot-connectors'

export type ProvisionUpdateConnectorsDeps = {
  getApp: GetInstalledAppRepository
  listConnectors: ListConnectorsRepository
  getInstanceRepo: GetInstanceRepository
  updateInstanceRepo: UpdateInstanceRepository
  updateConnectorRepo: UpdateConnectorRepository
  providerResolver: ConnectorProviderResolver
}

export async function deactivateConnectorsForApp(
  deps: ProvisionUpdateConnectorsDeps,
  appId: string,
): Promise<{ deactivated: number }> {
  const connectors = await deps.listConnectors.listConnectors(appId)

  let deactivated = 0
  for (const connector of connectors) {
    const instance = await deps.getInstanceRepo.getInstance(
      connector.instanceId,
    )
    if (!instance) {
      continue
    }

    const provider = connector.provider ?? ConnectorProvider.ZAPI
    try {
      await deps.providerResolver.resolve(provider).unsubscribe({
        instanceId: instance.instanceId,
        zApiToken: instance.zApiToken ?? null,
        channelId: instance.channelId ?? null,
      })
    } catch (error) {
      console.warn(
        `[thinkzap] falha ao cancelar assinatura do conector (${provider}/${instance.instanceId})`,
        error,
      )
    }

    await deps.updateInstanceRepo.markAsDisconnected(instance.id)
    await deps.updateConnectorRepo.markAsInactive(connector.id)
    deactivated += 1
  }

  if (deactivated > 0) {
    await syncThinkzapRobotConnectorOptions(appId)
  }

  return { deactivated }
}
