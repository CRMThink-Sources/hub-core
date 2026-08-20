import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiDisconectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'
import { apiLogger } from '@/shared/infra/logger'

/**
 * `DisconnectedCallback` da Z-API: avisa **a sala da instância**, não todo mundo.
 *
 * A versão anterior fazia `getIo().emit(...)` — broadcast para todos os sockets
 * conectados, com o evento cru. Só era inofensivo enquanto nenhum cliente
 * escutava; com um listener ligado, a desconexão de um cliente chegaria à tela de
 * todos os outros.
 *
 * Payload mínimo pela mesma razão do handler de conexão: ver `connected.handler.ts`.
 */
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
    await Promise.resolve()
  }
}
