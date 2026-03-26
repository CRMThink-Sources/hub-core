import { Instance } from '@/modules/thinkzap/domain/entities/instance'

export interface UpdateInstanceRepository {
  update(instance: Omit<Instance, 'createdAt' | 'updatedAt'>): Promise<Instance>
}
