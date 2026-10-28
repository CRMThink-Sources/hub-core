import type { Subscription } from '@/modules/application/domain/entities/subscription'

/**
 * O estado de uma assinatura no gateway, lido agora (sem cache), já traduzido pelo
 * **mesmo mapa de decisão do webhook**. É o que a sincronização Stripe aplica na SPA.
 */
export type GatewaySubscriptionState =
  | {
      kind: 'found'
      /** `null` quando o status do gateway está fora do mapa de decisão. */
      status: Subscription['status'] | null
      /** O status cru do gateway, para o histórico quando `status` é `null`. */
      rawStatus: string
      currentPeriodStart: Date
      currentPeriodEnd: Date
      /** Soma das quantidades dos itens — a mesma conta do webhook. */
      totalLineQuantity: number
    }
  /** O gateway respondeu que a assinatura não existe (404 / `resource_missing`). */
  | { kind: 'not-found' }

export interface GatewaySubscriptionStateReader {
  /** Lança em qualquer falha que não seja "não existe" (rede, chave, limite). */
  readSubscriptionState(
    gatewaySubscriptionId: string,
  ): Promise<GatewaySubscriptionState>
}
