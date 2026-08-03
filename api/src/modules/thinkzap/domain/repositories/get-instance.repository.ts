import { Instance } from '@/modules/thinkzap/domain/entities/instance'

/**
 * `getByDomainIdAndVinculatedChannel` saiu: o vínculo com canal aberto vive em
 * `ufCrm93Conector` no item de assinatura, e o roteamento resolve a linha por lá.
 * A coluna homônima da tabela deixou de ser escrita, então buscar por ela
 * devolveria o canal de antes da migração.
 */
export interface GetInstanceRepository {
  getInstance(instanceId: string): Promise<Instance | null>
  getInstanceByInstanceId(instanceId: string): Promise<Instance | null>
  getInstanceByChannelId(channelId: string): Promise<Instance | null>
}
