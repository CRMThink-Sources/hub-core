import { Instance } from '@/modules/thinkzap/domain/entities/instance'

/**
 * `updateSettings` saiu: `ConnectorSettings` vive em `ufCrm93Settings` no item de
 * assinatura, e nada mais escreve a coluna `settings` desta tabela. Reintroduzir
 * aqui recria a divergência que fazia admin e tenant gravarem em lugares
 * diferentes.
 */
export interface UpdateInstanceRepository {
  updateVinculatedChannel(
    instanceId: string,
    channelId: string | null,
  ): Promise<Instance>

  markAsDisconnected(instanceId: string): Promise<Instance>

  /**
   * Marca o conector HubMessage como conectado, persistindo dados da conexão Meta.
   * `webhookId` só vem quando o webhook foi criado agora (não existia no
   * provisionamento).
   */
  markAsConnected(
    instanceId: string,
    data: { wabaId: string; phoneId: string; webhookId?: string | null },
  ): Promise<Instance>
}
