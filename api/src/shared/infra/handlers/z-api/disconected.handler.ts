import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiDisconectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { enqueueThinkzapConnectionEvent } from '@/queue/thinkzap-connection-events.queue'
import { enqueueThinkzapLineConnectedSync } from '@/queue/thinkzap-line-connected-sync.queue'

// Emite só para a sala da instância e com payload mínimo (ver connected.handler.ts).
export class ZApiDisconectedHandler implements ZApiEventHandler {
  eventType = 'DisconnectedCallback'

  async handle(event: ZApiDisconectedEvent): Promise<void> {
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'z-api',
        eventType: this.eventType,
        instanceId: event.instanceId,
      },
      'Received Z-API disconnected event',
    )

    getIo().to(event.instanceId).emit('connector:disconnected', {
      status: 'disconnected',
    })

    await this.enqueueNotify(event)
    await this.enqueueLineConnectedSync(event)
  }

  // try/catch próprio: falhar o aviso não pode impedir a gravação, e vice-versa.
  private async enqueueLineConnectedSync(
    event: ZApiDisconectedEvent,
  ): Promise<void> {
    try {
      await enqueueThinkzapLineConnectedSync({
        provider: 'ZAPI',
        remoteId: event.instanceId,
        event: 'disconnected',
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
        { msg: 'Falha ao enfileirar gravação do campo Conectado (desconexão)' },
      )
    }
  }

  private async enqueueNotify(event: ZApiDisconectedEvent): Promise<void> {
    try {
      await enqueueThinkzapConnectionEvent({
        type: 'disconnected',
        instanceId: event.instanceId,
        momment: event.momment,
        error: event.error,
      })
    } catch (error) {
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
        { msg: 'Falha ao enfileirar aviso de desconexão Z-API' },
      )
    }
  }
}
