/**
 * Mais de uma linha ativa da instalação vinculada ao **mesmo** canal aberto.
 *
 * Não há resposta certa a escolher: as duas linhas dizem responder pelo canal, e cada
 * uma sai de um número de WhatsApp diferente. Antes o código pegava a primeira da
 * listagem do Bitrix — a mensagem saía por um número arbitrário, o provider aceitava, e
 * o contato daquele chat nunca recebia. Falha visível é melhor que envio pelo número
 * errado.
 *
 * Conserto é de dado, no CRM: desvincular o canal do item que não deveria tê-lo
 * (`ufCrm93Conector` na SPA 1146).
 */
export class AmbiguousChannelBindingError extends Error {
  constructor(
    readonly line: string,
    readonly subscriptionItemIds: string[],
  ) {
    super(
      `Canal aberto "${line}" está vinculado a ${subscriptionItemIds.length} linhas ativas ` +
        `(${subscriptionItemIds.join(', ')}) — não há como saber qual deve responder`,
    )
    this.name = 'AmbiguousChannelBindingError'
  }
}
