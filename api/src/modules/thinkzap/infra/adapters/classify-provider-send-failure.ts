import axios from 'axios'
import { AppError } from '@/shared/domain/errors/app-error'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'

/**
 * O que se sabe sobre a entrega depois de uma falha no envio ao provider.
 *
 * - `refused` — **o provider respondeu** com erro HTTP. Houve resposta, logo a
 *   requisição chegou inteira e foi recusada: nada foi entregue ao contato. É seguro
 *   retentar.
 * - `indeterminate` — **não houve resposta**: timeout, DNS, conexão derrubada. A
 *   requisição pode ter chegado e a resposta ter se perdido. Retentar aqui é apostar
 *   que não chegou, e quem paga a aposta errada é o contato, que lê a mensagem duas
 *   vezes.
 */
export type ProviderSendFailure = 'refused' | 'indeterminate'

/**
 * Classifica a falha de um envio ao provider pelo critério **houve resposta HTTP?**.
 *
 * Esta distinção não estava no desenho original desta change, que tratava toda falha
 * pós-reivindicação como indeterminada. Aplicada ao pé da letra, um `500` da Z-API —
 * transitório, com nada entregue — viraria estado terminal sem retentativa, que é
 * exatamente a perda de mensagem que esta change existe para acabar. O corte por
 * resposta recupera a retentativa sem abrir espaço para duplicidade.
 *
 * **Default conservador: `indeterminate`.** Na dúvida, não reenviar. Um falso
 * `indeterminate` custa uma mensagem não enviada e um aviso ao operador — ruim, mas
 * visível e recuperável por decisão humana. Um falso `refused` custa mensagem repetida
 * no WhatsApp do cliente do parceiro, que ninguém desfaz.
 */
export function classifyProviderSendFailure(
  error: unknown,
): ProviderSendFailure {
  /** HubMessage já carrega o status na exceção; `undefined` = sem resposta. */
  if (error instanceof HubMessageApiError) {
    return error.status === undefined ? 'indeterminate' : 'refused'
  }

  /**
   * Z-API: o client embrulha o `AxiosError` em `AppError` via `thinkzapError`, então a
   * resposta HTTP vive na `cause`. Sem desembrulhar, todo erro da Z-API pareceria
   * indeterminado e nenhum envio seria retentado.
   */
  const candidate = error instanceof AppError ? error.cause : error

  if (axios.isAxiosError(candidate)) {
    return candidate.response ? 'refused' : 'indeterminate'
  }

  return 'indeterminate'
}
