import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { CreateInstanceGateway } from '@/modules/thinkzap/domain/repositories/create-instance.gateway'
import { UpdateInstanceGateway } from '@/modules/thinkzap/domain/repositories/update-instance.gateway'
import {
  ConnectorConnectionStatus,
  ConnectorResourceRef,
  ConnectorStatusRef,
  ProvisionConnectorInput,
  ProvisionedConnectorResource,
  WhatsAppConnectorProvider,
} from '@/modules/thinkzap/domain/ports/whatsapp-connector-provider.port'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { apiLogger } from '@/shared/infra/logger'
import {
  logThinkzapError,
  thinkzapError,
} from '@/modules/thinkzap/errors/catalog'

/**
 * Adapter Z-API do contrato `WhatsAppConnectorProvider`. Envolve o gateway
 * Z-API on-demand (create/subscribe/unsubscribe) e o `ZApiClient` (disconnect),
 * preservando o comportamento anterior sem vazar tipos Z-API para a aplicação.
 */
export class ZApiConnectorProvider implements WhatsAppConnectorProvider {
  constructor(
    private readonly gateway: CreateInstanceGateway & UpdateInstanceGateway,
    private readonly zApiClient: ZApiClient,
  ) {}

  async provisionConnector(
    input: ProvisionConnectorInput,
  ): Promise<ProvisionedConnectorResource> {
    const instance = await this.gateway.create(input.name)
    return {
      instanceId: instance.id,
      status: InstanceStatus.CONNECTED,
      zApiToken: instance.token,
    }
  }

  async subscribe(ref: ConnectorResourceRef): Promise<void> {
    const token = this.requireToken(ref)
    await this.gateway.subscribe(ref.instanceId, token)
  }

  async unsubscribe(ref: ConnectorResourceRef): Promise<void> {
    const token = this.requireToken(ref)
    await this.gateway.unsubscribe(ref.instanceId, token)
  }

  async disconnect(ref: ConnectorResourceRef): Promise<void> {
    const token = this.requireToken(ref)
    await this.zApiClient.disconnectInstance(ref.instanceId, token)
  }

  async getConnectionStatus(
    ref: ConnectorStatusRef,
  ): Promise<ConnectorConnectionStatus> {
    if (!ref.zApiToken) {
      return { connected: false, available: false }
    }
    try {
      const status = await this.zApiClient.getInstanceStatus(
        ref.instanceId,
        ref.zApiToken,
      )
      return { connected: status.connected === true, available: true }
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.zapi.instance_status_failed',
        { app: 'thinkzap', instanceId: ref.instanceId, err: error },
        {
          level: 'warn',
          msg: 'Z-API: falha ao consultar status do conector — status ao vivo indisponível',
        },
      )
      return { connected: false, available: false }
    }
  }

  private requireToken(ref: ConnectorResourceRef): string {
    if (!ref.zApiToken) {
      throw thinkzapError('thinkzap.provisioning.credential_missing')
    }
    return ref.zApiToken
  }
}
