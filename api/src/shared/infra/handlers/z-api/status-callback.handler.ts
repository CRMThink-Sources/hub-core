import { ZApiEventHandler } from '../z-api-event-handler'
import { StatusCallbackEvent } from './z-api'

/**
 * Confirmação de entrega da Z-API — **só reconhecida, nada é feito com ela.**
 *
 * O handler continua registrado porque a Z-API manda este evento para a mesma URL das
 * mensagens: sem handler o controller responde `404`, e o webhook passa a parecer
 * quebrado do lado do provider.
 *
 * Ele já foi o **reparo** da conversa do canal aberto: ao ver `SENT` numa mensagem do
 * widget ainda sem `chat_id`, chamava `EnsureWidgetOpenChannelConversation` na hora.
 * Isso abria **duas conversas** para um único envio. O `SENT` chega 1–3s depois do
 * aceite, e o job `open-channel` só grava o `chat_id` depois que o Bitrix responde —
 * a janela é de segundos, e nela o callback lia `NULL`, achava que a abertura tinha
 * falhado e postava de novo. O guard de idempotência é leitura-depois-escrita, então
 * as duas chamadas passavam; e o `jobId` determinístico da fila não ajudava porque o
 * reparo não passava por ela. Pior: o reparo resolvia a identidade por `event.phone` e
 * sem a entidade do CRM, então a segunda conversa ainda podia nascer com outro
 * `chat.id` e com o telefone como nome.
 *
 * O reparo saiu porque deixou de ter o que reparar. Ele é da época em que a abertura
 * rodava dentro do request, sem retentativa; hoje o job `open-channel` tem `attempts`
 * próprios, e é ele o único dono da abertura.
 */
export class StatusCallbackHandler implements ZApiEventHandler {
  eventType = 'MessageStatusCallback'

  async handle(_event: StatusCallbackEvent): Promise<void> {}
}
