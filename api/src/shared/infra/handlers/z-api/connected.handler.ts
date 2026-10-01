import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiConnectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { enqueueThinkzapConnectionEvent } from '@/queue/thinkzap-connection-events.queue'
import { enqueueThinkzapLineConnectedSync } from '@/queue/thinkzap-line-connected-sync.queue'

// Payload mínimo: socket não autentica `join`; emitir o evento cru vazaria o telefone. Cliente relê a rota.
export class ZApiConnectedHandler implements ZApiEventHandler {
  eventType = 'ConnectedCallback'

  async handle(event: ZApiConnectedEvent): Promise<void> {
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'z-api',
        eventType: this.eventType,
        instanceId: event.instanceId,
      },
      'Received Z-API connected event',
    )

    getIo().to(event.instanceId).emit('instance:connected', {
      status: 'connected',
    })

    await this.enqueueNotify(event)
    await this.enqueueLineConnectedSync(event)
  }

  // try/catch próprio: falhar o aviso não pode impedir a gravação, e vice-versa.
  private async enqueueLineConnectedSync(
    event: ZApiConnectedEvent,
  ): Promise<void> {
    try {
      await enqueueThinkzapLineConnectedSync({
        provider: 'ZAPI',
        remoteId: event.instanceId,
        event: 'connected',
        momment: event.momment,
      })
    } catch (error) {
      logThinkzapError(
        apiLogger,
        'thinkzap.line.connected_sync_enqueue_failed',
        {
          app: 'thinkzap',
          source: 'z-api',
          eventType: this.eventType,
          instanceId: event.instanceId,
          err: error,
        },
        { msg: 'Falha ao enfileirar gravação do campo Conectado (conexão)' },
      )
    }
  }

  private async enqueueNotify(event: ZApiConnectedEvent): Promise<void> {
    try {
      await enqueueThinkzapConnectionEvent({
        type: 'connected',
        instanceId: event.instanceId,
        momment: event.momment,
        phone: event.phone,
      })
    } catch (error) {
      // Enfileirar nunca pode derrubar o webhook.
      logThinkzapError(
        apiLogger,
        'thinkzap.line.connection_notify_enqueue_failed',
        {
          app: 'thinkzap',
          source: 'z-api',
          eventType: this.eventType,
          instanceId: event.instanceId,
          err: error,
        },
        { msg: 'Falha ao enfileirar aviso de conexão Z-API' },
      )
    }
  }
}
