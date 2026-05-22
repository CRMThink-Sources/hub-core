import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { GetConnectorRepository } from '@/modules/thinkzap/domain/repositories/get-connector.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'

export type ResolvedZApiInstance = {
  instanceId: string
  zApiToken: string
  instancePhone: string | null
}

export async function resolveZApiInstance(
  connectorId: string,
  getConnectorRepository: GetConnectorRepository,
  getInstanceRepository: GetInstanceRepository,
  zApiClient: ZApiClient,
): Promise<ResolvedZApiInstance> {
  const connector = await getConnectorRepository.get(connectorId)
  if (!connector) {
    throw new Error('Connector not found')
  }

  const instance = await getInstanceRepository.getInstance(connector.instanceId)
  if (!instance) {
    throw new Error('Instance not found')
  }
  if (!instance.zApiToken) {
    throw new Error('Instance token not found')
  }
  if (instance.status !== InstanceStatus.CONNECTED) {
    throw new Error('Instance is not connected')
  }

  let instancePhone: string | null = instance.phoneNumber
  if (!instancePhone) {
    try {
      const phoneData = await zApiClient.getPhoneData(
        instance.instanceId,
        instance.zApiToken,
      )
      instancePhone = phoneData?.phone ?? null
    } catch {
      instancePhone = null
    }
  }

  return {
    instanceId: instance.instanceId,
    zApiToken: instance.zApiToken,
    instancePhone,
  }
}
