import { randomUUID } from 'crypto'

import { CreateConnectorRepository } from '@/modules/thinkzap/domain/repositories/create-connector.repository'
import { CreateInstanceGateway } from '@/modules/thinkzap/domain/repositories/create-instance.gateway'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { ListConnectorsRepository } from '@/modules/thinkzap/domain/repositories/list-connectors'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS } from '@/modules/thinkzap/domain/trial-connector-limit'
import { UpdateInstanceGateway } from '../domain/repositories/update-instance.gateway'
import { syncThinkzapRobotConnectorOptions } from './sync-robot-connectors'
import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'

export type ProvisionMissingConnectorsDeps = {
  createConnectorRepo: CreateConnectorRepository
  instanceGateway: CreateInstanceGateway & UpdateInstanceGateway
  createInstanceRepo: CreateInstanceRepository
  getApp: GetInstalledAppRepository
  getDomainRepository: GetDomainRepository
  listConnectors: ListConnectorsRepository
  billingSubscriptionRepo: GetBillingSubscriptionRepository &
    UpdateBillingSubscriptionRepository
}

export async function provisionMissingConnectorsForApp(
  deps: ProvisionMissingConnectorsDeps,
  appId: string,
  targetConnectorSlots: number,
  options?: { isTrialing?: boolean },
): Promise<{ created: number }> {
  const requestedTarget = Math.max(0, Math.floor(targetConnectorSlots))
  const isTrialing = options?.isTrialing === true
  const target = isTrialing
    ? Math.min(requestedTarget, THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS)
    : requestedTarget

  const list = await deps.listConnectors.listConnectors(appId, true)
  await syncThinkzapRobotConnectorOptions(appId)
  if (!isTrialing) {
    for (const connector of list) {
      const instance = connector.instance
      if (!instance?.zApiToken) continue

      try {
        await deps.instanceGateway.subscribe(
          instance.instanceId,
          instance.zApiToken,
        )
      } catch (error) {
        console.warn(
          `[thinkzap] falha ao assinar instância existente no z-api (${instance.instanceId})`,
          error,
        )
      }
    }
  }

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
    const instance = await deps.instanceGateway.create(instanceName)
    if (!isTrialing) {
      await deps.instanceGateway.subscribe(instance.id, instance.token)
    }

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

  await syncThinkzapRobotConnectorOptions(appId)

  return { created: need }
}
