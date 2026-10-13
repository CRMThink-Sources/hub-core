import type { Subscription } from '@/modules/application/domain/entities/subscription'

/**
 * Leitura do **status** de uma assinatura da SPA 1142, sem cache e sem hidratação.
 *
 * Existe para a regra de cobrança do recurso no provider, que só precisa de uma coisa da
 * assinatura pai: se ela está ativa e não é trial. O repositório de domínio serve, mas
 * com cache — e é exatamente a mudança de status da assinatura (manual passada para
 * "Ativo" no CRM) que dispara esta leitura. Ler cache velho ali assinaria linha de
 * contrato cancelado, ou deixaria de assinar a de contrato pago.
 *
 * Sem hidratar plano e aplicação pelo mesmo motivo de custo: o job roda a cada edição de
 * item, e a decisão não depende de nenhum dos dois.
 */
export interface SubscriptionStatusReader {
  /** `null` quando a assinatura não existe mais. */
  getSubscriptionStatus(
    subscriptionId: string,
  ): Promise<Subscription['status'] | null>
}
