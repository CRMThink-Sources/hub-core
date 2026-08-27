/**
 * Descarte da leitura cacheada de uma assinatura do gateway.
 *
 * Port separado do de leitura de propósito: quem lê é o caso de uso da tela, quem
 * invalida é o caminho que **escreve** no gateway, e são dois lados que nunca se
 * chamam. O adapter cru do gateway implementa só a leitura — não há o que invalidar
 * quando não há cache —, e juntar os dois métodos num port só obrigaria o adapter a
 * carregar um `invalidate` vazio.
 */
export interface GatewaySubscriptionCacheInvalidator {
  invalidate(gatewaySubscriptionId: string): Promise<void>
}
