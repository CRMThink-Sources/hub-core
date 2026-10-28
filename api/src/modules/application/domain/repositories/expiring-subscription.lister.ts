import { ExpirableSubscription } from '@/modules/application/domain/subscription-expiration'

/**
 * Os cortes da SPA 1142 que a verificação de assinaturas varre. São filtros largos
 * de propósito — quem decide é `resolveExpiredSubscriptionStatus` e
 * `resolvePastDueAction`, nunca a listagem.
 *
 * Existe à parte do `SubscriptionRepository` porque a varredura é sobre a SPA
 * inteira: a listagem dele não pagina, e hidrata plano e aplicação lançando erro
 * por qualquer um faltando — uma assinatura quebrada pararia a expiração de todas.
 * Item inválido aqui é descartado, não lançado. Sem cache: quem chama é o job.
 */
export interface ExpiringSubscriptionLister {
  /** `trialing` ou `active` com o fim do período até `now`. */
  listExpiring(now: Date): Promise<ExpirableSubscription[]>
  /** `past_due`, qualquer modalidade — o corte de modalidade é da regra. */
  listPastDue(): Promise<ExpirableSubscription[]>
  /** Qualquer status com "Vencido em" preenchido — a limpeza filtra os `past_due`. */
  listWithPastDueAt(): Promise<ExpirableSubscription[]>
  /** Ids das assinaturas `active`, para a reconciliação das linhas. */
  listActiveIds(): Promise<string[]>
}
