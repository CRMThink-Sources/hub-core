import { Instance } from '../entities/instance'

/** Campos provider-specific (HubMessage) são opcionais na criação — nulos para Z-API. */
export type CreateInstanceInput = Omit<
  Instance,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'channelId'
  | 'webhookId'
  | 'wabaId'
  | 'phoneId'
> &
  Partial<Pick<Instance, 'channelId' | 'webhookId' | 'wabaId' | 'phoneId'>>

export interface CreateInstanceRepository {
  create(instance: CreateInstanceInput): Promise<Instance>
}
