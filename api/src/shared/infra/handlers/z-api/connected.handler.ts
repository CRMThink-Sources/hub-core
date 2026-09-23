import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiConnectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'
import { apiLogger } from '@/shared/infra/logger'
import { enqueueThinkzapConnectionEvent } from '@/queue/thinkzap-connection-events.queue'
import { enqueueThinkzapLineConnectedSync } from '@/queue/thinkzap-line-connected-sync.queue'

/**
 * `ConnectedCallback` da Z-API: avisa a sala da instância que o estado mudou.
 *
 * O payload é só o aviso. O evento cru carrega `phone`, `lid` e `isBusiness`, e a
 * sala tem o nome do `instanceId` num socket que não autentica handshake nem
 * `join` — emitir o corpo entregaria o telefone do cliente a quem adivinhasse o
 * `instanceId`. Quem recebe o aviso relê `GET /thinkzap/lines/:itemId/connection`,
 * que verifica acesso.
 *
 * Consequência desejada: o socket nunca é fonte de estado, só gatilho de
 * releitura — não existe o caso de o evento e a rota discordarem na tela.
 *
 * Além do socket, enfileira o aviso de reconexão aos destinatários configurados (ver
 * `thinkzap-connection-notify.processor.ts`) — enfileirar e não processar inline
 * porque resolver domínio/app/destinatários é trabalho de fila, não de webhook: se
 * falhar, o BullMQ retenta sozinho.
 */
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

  /**
   * Grava o campo Conectado do item da linha. Enfileiramento próprio, com
   * `try/catch` próprio: falhar o aviso não pode impedir a gravação, e vice-versa.
   */
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
      apiLogger.warn(
        {
          app: 'thinkzap',
          source: 'z-api',
          eventType: this.eventType,
          instanceId: event.instanceId,
          error,
        },
        'Falha ao enfileirar gravação do campo Conectado (conexão)',
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
      // Enfileirar nunca pode derrubar o webhook — o Redis fora do ar não é motivo
      // pra Z-API receber erro num evento que ela mesma vai reenviar sem ajuda.
      apiLogger.warn(
        {
          app: 'thinkzap',
          source: 'z-api',
          eventType: this.eventType,
          instanceId: event.instanceId,
          error,
        },
        'Falha ao enfileirar aviso de conexão Z-API',
      )
    }
  }
}
