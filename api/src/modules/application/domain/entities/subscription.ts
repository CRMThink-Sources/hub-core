import { Aplication } from './aplication'
import { Plan } from './plan'

/**
 * Como a assinatura é cobrada — não **se** ela vale.
 *
 * `stripe`: self-service, com checkout, webhook e portal de faturamento.
 * `manual`: boleto, mantida por automação fora do produto, que escreve direto
 * nas SPAs. A aplicação lê e obedece.
 *
 * **Nenhum caminho de decisão de habilitação consulta este campo.**
 * `resolveLineEntitlement` decide por `status` e janela; a modalidade só governa
 * o que a tela oferece e quem dispara ciclo de cobrança no provider.
 */
export type SubscriptionModality = 'stripe' | 'manual'

export interface Subscription {
  id: string
  name: string
  plan: Plan
  /**
   * `trial_expired` (enum `14353`, "Teste expirado" na SPA) é o teste encerrado
   * **por marcação**, feita de fora do produto — operação ou automação do CRM.
   * Nenhum caminho daqui o escreve; o produto só o lê. Ele é gravável pelo mesmo
   * mapa que o lê para não existir um segundo mapa capaz de dessincronizar.
   *
   * Não confundir com `trialing` fora da janela, que é o teste expirado **pelo
   * tempo**. Os dois são de teste e resolvem o mesmo entitlement; a diferença é
   * quem encerrou. Use o predicado de `connector-trial.ts` em vez de comparar
   * com literais — é o que evita um status novo virar um bug por chamador.
   */
  status: 'active' | 'past_due' | 'cancelled' | 'trialing' | 'trial_expired'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  /**
   * Instalação que esta assinatura paga, hidratada. O cliente chega por
   * `aplication.customer`, sem leitura adicional.
   */
  aplication: Aplication
  /**
   * Sempre resolvida, **nunca** `undefined`: campo ausente, vazio ou com valor
   * desconhecido na SPA resolve `manual`. O default conservador é "não sabemos
   * gerenciar isso" — oferecer portal do gateway para assinatura que não é dele
   * daria erro na cara do cliente, e não oferecer é só uma ação a menos.
   */
  modality: SubscriptionModality
  /**
   * Não há `product` de propósito: a SPA 1142 não tem campo de produto — os
   * userfields dela são `UF_CRM_91_CLIENT`, `_STATUS`, `_CURRENT_PERIOD_START`,
   * `_CURRENT_PERIOD_END`, `_CANCELED_AT`, `_GATEWAY_ID` e `_PLAN`. O produto
   * cobrado é o do plano: `subscription.plan.product`.
   */
  gatewayId?: string
}
