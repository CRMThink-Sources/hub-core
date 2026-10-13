import { ExpirableSubscription } from '@/modules/application/domain/subscription-expiration'

/**
 * As assinaturas que **podem** ter vencido: `trialing` ou `active` com o fim do
 * período até `now`. É filtro largo de propósito — quem decide é
 * `resolveExpiredSubscriptionStatus`, nunca a listagem.
 *
 * Existe à parte do `SubscriptionRepository` porque a varredura é sobre a SPA
 * inteira: a listagem dele não pagina, e hidrata plano e aplicação lançando erro
 * por qualquer um faltando — uma assinatura quebrada pararia a expiração de todas.
 * Item inválido aqui é descartado, não lançado. Sem cache: quem chama é o job.
 */
export interface ExpiringSubscriptionLister {
  listExpiring(now: Date): Promise<ExpirableSubscription[]>
}
