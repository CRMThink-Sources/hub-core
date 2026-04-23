import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { ListConnectorsRepository } from '@/modules/thinkzap/domain/repositories/list-connectors'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { UpdateInstanceRepository } from '@/modules/thinkzap/domain/repositories/update-instance.repository'
import { UpdateConnectorRepository } from '@/modules/thinkzap/domain/repositories/update-connector.repository'
import { UpdateInstanceGateway } from '@/modules/thinkzap/domain/repositories/update-instance.gateway'

export type ProvisionUpdateConnectorsDeps = {
  getApp: GetInstalledAppRepository
  listConnectors: ListConnectorsRepository
  getInstanceRepo: GetInstanceRepository
  updateInstanceRepo: UpdateInstanceRepository
  updateConnectorRepo: UpdateConnectorRepository
  updateInstanceGateway: UpdateInstanceGateway
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

    if (instance.zApiToken) {
      await deps.updateInstanceGateway.unsubscribe(
        instance.instanceId,
        instance.zApiToken,
      )
    }

    await deps.updateInstanceRepo.markAsDisconnected(instance.id)
    await deps.updateConnectorRepo.markAsInactive(connector.id)
    deactivated += 1
  }

  return { deactivated }
}
