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
