import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiDisconectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'
import { apiLogger } from '@/shared/infra/logger'
import { enqueueThinkzapConnectionEvent } from '@/queue/thinkzap-connection-events.queue'
import { enqueueThinkzapLineConnectedSync } from '@/queue/thinkzap-line-connected-sync.queue'

/**
 * `DisconnectedCallback` da Z-API: avisa **a sala da instância**, não todo mundo.
 *
 * A versão anterior fazia `getIo().emit(...)` — broadcast para todos os sockets
 * conectados, com o evento cru. Só era inofensivo enquanto nenhum cliente
 * escutava; com um listener ligado, a desconexão de um cliente chegaria à tela de
 * todos os outros.
 *
 * Payload mínimo pela mesma razão do handler de conexão: ver `connected.handler.ts`.
 *
 * Além do socket, enfileira o aviso de desconexão aos destinatários configurados
 * (ver `thinkzap-connection-notify.processor.ts`, consumido pela fila
 * `thinkzap-connection-events`) — resolver domínio/app/destinatários e chamar o
 * Bitrix não acontece mais aqui dentro do webhook: se falhar, quem retenta é o
 * BullMQ, não este handler.
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

    await this.enqueueNotify(event)
    await this.enqueueLineConnectedSync(event)
  }

  /**
   * Grava o campo Conectado do item da linha. Enfileiramento próprio, com
   * `try/catch` próprio: falhar o aviso não pode impedir a gravação, e vice-versa.
   */
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
      apiLogger.warn(
        {
          app: 'thinkzap',
          source: 'z-api',
          eventType: this.eventType,
          instanceId: event.instanceId,
          error,
        },
        'Falha ao enfileirar gravação do campo Conectado (desconexão)',
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
      apiLogger.warn(
        {
          app: 'thinkzap',
          source: 'z-api',
          eventType: this.eventType,
          instanceId: event.instanceId,
          error,
        },
        'Falha ao enfileirar aviso de desconexão Z-API',
      )
    }
  }
}
