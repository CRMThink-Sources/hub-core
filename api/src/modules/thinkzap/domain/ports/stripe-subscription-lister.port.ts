/** Uma assinatura Stripe da SPA 1142, com o que a sincronização precisa para escolher. */
export type StripeSubscriptionRef = {
  id: string
  /** `null` quando o campo está vazio — a assinatura não tem par no gateway. */
  gatewayId: string | null
  /** `UF_CRM_91_ENVIRONMENT` cru; vazio é `null`. */
  environment: string | null
}

export interface StripeSubscriptionLister {
  /** Todas as assinaturas de modalidade `stripe`, paginadas pela SPA inteira. */
  listStripeSubscriptions(): Promise<StripeSubscriptionRef[]>
}
