import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiConnectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'
import { apiLogger } from '@/shared/infra/logger'

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
    await Promise.resolve()
  }
}
