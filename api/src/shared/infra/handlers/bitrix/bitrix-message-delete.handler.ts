import type { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { apiLogger } from '@/shared/infra/logger'

/**
 * Descarta `ONIMCONNECTORMESSAGEDELETE`.
 *
 * A sincronização de exclusão de mensagem foi descontinuada: nada é enfileirado, e
 * exclusão feita no CRM deixa de ser refletida no WhatsApp.
 *
 * **Por que o handler continua existindo.** Evento sem handler registrado responde
 * `404`, e o Bitrix reentrega `404` em backoff — o que transformaria cada exclusão
 * de mensagem numa fila de retentativas. Registrado e descartando, a resposta é
 * `200` e o evento morre aqui.
 *
 * **Temporário por construção.** As instalações existentes ainda têm o bind, e é o
 * script de `event.unbind` que fecha isso. Depois de ele rodar em toda a base, o
 * evento para de chegar e este handler pode sair junto com o registro.
 */
export class BitrixMessageDeleteHandler implements BitrixEventHandler {
  eventType = 'ONIMCONNECTORMESSAGEDELETE'

  async handle(event: IBX24MessageEvent): Promise<void> {
    apiLogger.info(
      {
        app: 'thinkzap',
        source: 'bitrix',
        domain: event.auth?.domain,
      },
      'Evento de exclusão de mensagem descartado — recurso descontinuado, bind pendente de remoção',
    )

    return Promise.resolve()
  }
}
