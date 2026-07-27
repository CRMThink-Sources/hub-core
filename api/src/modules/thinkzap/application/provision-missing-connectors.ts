import { randomUUID } from 'crypto'

import { CreateConnectorRepository } from '@/modules/thinkzap/domain/repositories/create-connector.repository'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { ListConnectorsRepository } from '@/modules/thinkzap/domain/repositories/list-connectors'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS } from '@/modules/thinkzap/domain/trial-connector-limit'
import { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import { ConnectorResourceRef } from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { syncThinkzapRobotConnectorOptions } from './sync-robot-connectors'
import { GetBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/get-billing-subscription.repository'
import { UpdateBillingSubscriptionRepository } from '@/shared/domain/repositories/billing-subscription/update-billing-subscription.repository'

export type ProvisionMissingConnectorsDeps = {
  createConnectorRepo: CreateConnectorRepository
  providerResolver: ConnectorProviderResolver
  createInstanceRepo: CreateInstanceRepository
  getApp: GetInstalledAppRepository
  getDomainRepository: GetDomainRepository
  listConnectors: ListConnectorsRepository
  billingSubscriptionRepo: GetBillingSubscriptionRepository &
    UpdateBillingSubscriptionRepository
}

/** Referência de recurso remoto a partir de um conector já persistido. */
function toResourceRef(instance: {
  instanceId: string
  zApiToken?: string | null
  channelId?: string | null
}): ConnectorResourceRef {
  return {
    instanceId: instance.instanceId,
    zApiToken: instance.zApiToken ?? null,
    channelId: instance.channelId ?? null,
  }
}

/**
 * Provisiona conectores de um provider específico até `targetConnectorSlots`.
 * Idempotente: garante N conectores do provider, criando só os que faltam e
 * (fora de trial) assinando os existentes. Providers são independentes entre si.
 */
export async function provisionMissingConnectorsForProvider(
  deps: ProvisionMissingConnectorsDeps,
  appId: string,
  provider: ConnectorProvider,
  targetConnectorSlots: number,
  options?: { isTrialing?: boolean },
): Promise<{ created: number }> {
  const requestedTarget = Math.max(0, Math.floor(targetConnectorSlots))
  const isTrialing = options?.isTrialing === true
  const target = isTrialing
    ? Math.min(requestedTarget, THINKZAP_TRIAL_MAX_CONNECTOR_SLOTS)
    : requestedTarget

  const providerAdapter = deps.providerResolver.resolve(provider)

  const all = await deps.listConnectors.listConnectors(appId, true)
  const list = all.filter(
    c => (c.provider ?? ConnectorProvider.ZAPI) === provider,
  )

  if (!isTrialing) {
    for (const connector of list) {
      const instance = connector.instance
      if (!instance) continue
      try {
        await providerAdapter.subscribe(toResourceRef(instance))
      } catch (error) {
        console.warn(
          `[thinkzap] falha ao assinar conector existente (${provider}/${instance.instanceId})`,
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
    const resource = await providerAdapter.provisionConnector({
      name: instanceName,
    })

    if (!isTrialing) {
      await providerAdapter.subscribe(toResourceRef(resource))
    }

    const persistedInstance = await deps.createInstanceRepo.create({
      domainId: domain.id,
      instanceId: resource.instanceId,
      phoneNumber: null,
      status: resource.status ?? InstanceStatus.CONNECTED,
      zApiToken: resource.zApiToken ?? null,
      channelId: resource.channelId ?? null,
      webhookId: resource.webhookId ?? null,
      wabaId: resource.wabaId ?? null,
      phoneId: resource.phoneId ?? null,
      vinculatedChannel: null,
      settings: { ...DEFAULT_CONNECTOR_SETTINGS },
    })

    await deps.createConnectorRepo.createConnector({
      instanceId: persistedInstance.id,
      appId,
      provider,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  await syncThinkzapRobotConnectorOptions(appId)

  return { created: need }
}

/**
 * Compat: provisiona conectores Z-API (comportamento anterior). Novos fluxos
 * multi-provider devem chamar `provisionMissingConnectorsForProvider`.
 */
export async function provisionMissingConnectorsForApp(
  deps: ProvisionMissingConnectorsDeps,
  appId: string,
  targetConnectorSlots: number,
  options?: { isTrialing?: boolean },
): Promise<{ created: number }> {
  return provisionMissingConnectorsForProvider(
    deps,
    appId,
    ConnectorProvider.ZAPI,
    targetConnectorSlots,
    options,
  )
}
