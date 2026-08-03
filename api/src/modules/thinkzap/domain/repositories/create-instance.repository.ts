import { Instance } from '../entities/instance'

/**
 * Campos provider-specific (HubMessage) são opcionais na criação — nulos para Z-API.
 *
 * `settings` fica **fora**: a coluna `settings` de `core_thinkerszap_instances` está
 * deprecada e ninguém a lê para decidir comportamento. A fonte é `ufCrm93Settings`
 * no item da SPA. Aceitar o campo aqui convidaria a reintroduzir a escrita, e o
 * `@default("{}")` da coluna já satisfaz o `NOT NULL` sem que o `INSERT` a mencione.
 */
export type CreateInstanceInput = Omit<
  Instance,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'settings'
  | 'channelId'
  | 'webhookId'
  | 'wabaId'
  | 'phoneId'
> &
  Partial<Pick<Instance, 'channelId' | 'webhookId' | 'wabaId' | 'phoneId'>>

export interface CreateInstanceRepository {
  create(instance: CreateInstanceInput): Promise<Instance>
}
