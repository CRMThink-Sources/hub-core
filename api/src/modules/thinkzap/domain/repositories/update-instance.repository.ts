import { Instance } from '@/modules/thinkzap/domain/entities/instance'

export interface UpdateInstanceRepository {
  updateVinculatedChannel(
    instanceId: string,
    channelId: string | null,
  ): Promise<Instance>
}
