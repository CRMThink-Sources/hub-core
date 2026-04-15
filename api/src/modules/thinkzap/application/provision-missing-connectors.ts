import { randomUUID } from 'crypto'

import { CreateConnectorRepository } from '@/modules/thinkzap/domain/repositories/create-connector.repository'
import { CreateInstanceGateway } from '@/modules/thinkzap/domain/repositories/create-instance.gateway'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { ListConnectorsRepository } from '@/modules/thinkzap/domain/repositories/list-connectors'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS } from '@/modules/thinkzap/domain/trial-connector-limit'

export type ProvisionMissingConnectorsDeps = {
  createConnectorRepo: CreateConnectorRepository
  createInstanceGateway: CreateInstanceGateway
  createInstanceRepo: CreateInstanceRepository
  getApp: GetInstalledAppRepository
  getDomainRepository: GetDomainRepository
  listConnectors: ListConnectorsRepository
}

/**
 * Garante que existam instâncias Z-API + registros de conector no banco até o limite
 * `targetConnectorSlots` (quantidade contratada na assinatura).
 * Em trial (`isTrialing`), não ultrapassa {@link THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS}.
 */
export async function provisionMissingConnectorsForApp(
  deps: ProvisionMissingConnectorsDeps,
  appId: string,
  targetConnectorSlots: number,
  options?: { isTrialing?: boolean },
): Promise<{ created: number }> {
  let target = Math.max(0, Math.floor(targetConnectorSlots))
  if (options?.isTrialing) {
    target = Math.min(target, THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS)
  }

  const list = await deps.listConnectors.listConnectors(appId)
  const current = list.length
  const need = Math.max(0, target - current)
  if (need < 1) return { created: 0 }

  const installedApp = await deps.getApp.getById(appId)
  if (!installedApp) throw new Error(`Installed app not found: ${appId}`)

  const domain = await deps.getDomainRepository.getDomainById(
    installedApp.domainId,
  )
  if (!domain) throw new Error(`Domain not found: ${installedApp.domainId}`)

  for (let i = 0; i < need; i++) {
    const instanceName = domain.name + ' | ' + `instance-${randomUUID()}`
    const instance = await deps.createInstanceGateway.create(instanceName)

    const persistedInstance = await deps.createInstanceRepo.create({
      domainId: domain.id,
      instanceId: instance.id,
      phoneNumber: null,
      status: InstanceStatus.CONNECTED,
      zApiToken: instance.token,
      vinculatedChannel: null,
    })

    await deps.createConnectorRepo.createConnector({
      instanceId: persistedInstance.id,
      appId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  return { created: need }
}
