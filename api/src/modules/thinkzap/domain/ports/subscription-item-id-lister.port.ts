/**
 * Os ids dos itens (SPA 1146) de uma assinatura (SPA 1142), lidos crus.
 *
 * Existe porque o repositório de domínio não serve à cobrança por assinatura: ele passa
 * pelo mapper estrito, que **recusa** item com provider declarado e sem credencial — o
 * item manual ainda não provisionado, comum justamente na assinatura que acabou de ser
 * criada. Um item assim derrubaria a listagem inteira, e as outras linhas ficariam sem
 * assinar. Com os ids, cada item segue pela leitura crua de `SyncSpaItemResourceStatus`,
 * que trata o não provisionado como estado e não como erro.
 *
 * Também sem cache: quem chama é o job disparado pela edição da assinatura.
 */
export interface SubscriptionItemIdLister {
  listSubscriptionItemIds(subscriptionId: string): Promise<string[]>
}
