import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'

/**
 * Distingue "o provider caiu" de "o provider recusou o que mandamos".
 *
 * O corte é o status: `5xx` e ausência de status (falha de rede, DNS, timeout —
 * `HubMessageApiError` nasce com `status: undefined` nesses casos) são
 * indisponibilidade; `4xx` é recusa e a mensagem do provider é o que interessa.
 *
 * DEFAULT CONSERVADOR, ao contrário de `isConversationWindowClosedError`: aqui a
 * dúvida pende para `false`. Classificar recusa como indisponibilidade esconderia do
 * operador o motivo real ("template não encontrado") atrás de um "tente mais tarde"
 * que nunca vai funcionar. O inverso apenas mantém o comportamento anterior — texto
 * cru na tela.
 *
 * Caso real que motivou isto: `POST /v1/channels/{id}/messages` respondeu
 * `502 {"error":"barling returned status 502"}` — serviço interno da HubMessage fora,
 * nada a ver com o payload.
 */
export function isProviderUnavailableError(error: unknown): boolean {
  if (!(error instanceof HubMessageApiError)) return false

  // Sem status: a requisição não chegou a ter resposta HTTP.
  if (error.status === undefined) return true

  return error.status >= 500
}
