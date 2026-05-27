import { Instance } from '@/modules/thinkzap/domain/entities/instance'
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'

export interface UpdateInstanceRepository {
  updateVinculatedChannel(
    instanceId: string,
    channelId: string | null,
  ): Promise<Instance>

  updateSettings(
    instanceId: string,
    settings: ConnectorSettings,
  ): Promise<Instance>

  markAsDisconnected(instanceId: string): Promise<Instance>
}
