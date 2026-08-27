import type { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Descarta `ONIMCONNECTORMESSAGEUPDATE`.
 *
 * A sincronização de edição de mensagem foi descontinuada junto com a de exclusão:
 * nada é enfileirado, e edição feita no CRM deixa de ser refletida no WhatsApp. A
 * direção oposta — WhatsApp → Bitrix — continua inteira.
 *
 * **Por que o handler continua existindo.** Evento sem handler registrado responde
 * `404`, e o Bitrix reentrega `404` em backoff — o que transformaria cada edição de
 * mensagem numa fila de retentativas. Registrado e descartando, a resposta é `200` e
 * o evento morre aqui.
 *
 * **Temporário por construção**, como o de delete: as instalações existentes ainda
 * têm o bind, e é o script de `event.unbind` que fecha isso.
 */
export class BitrixMessageUpdateHandler implements BitrixEventHandler {
  eventType = 'ONIMCONNECTORMESSAGEUPDATE'

  async handle(event: IBX24MessageEvent): Promise<void> {
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix',
        domain: event.auth?.domain,
      },
      'Evento de edição de mensagem descartado — recurso descontinuado, bind pendente de remoção',
    )

    return Promise.resolve()
  }
}
