import { Subscription } from './subscription'

/**
 * A assinatura como o **gateway** a conhece.
 *
 * Vive junto de `PlanPrice`, e pelo mesmo motivo: é a forma normalizada de um dado
 * que o gateway define, e o vocabulário do provedor (`items.data`, `unpaid`,
 * `incomplete_expired`) fica no adapter. Trocar de gateway não pode reescrever a
 * regra de exibição.
 *
 * **Não substitui a assinatura da SPA.** O que o runtime obedece — se a linha
 * funciona, quando o período acaba, qual o status — continua saindo de
 * `Subscription`. Esta leitura serve a uma pergunta só: **quanto** o gateway cobra,
 * e por quantas linhas. Misturar as duas criaria duas respostas possíveis para
 * "a linha está habilitada?", que é exatamente o que `GetLineSubscriptionState`
 * documenta evitar.
 */
export type GatewaySubscription = {
  /**
   * Status normalizado para o vocabulário da SPA, mais `unknown`.
   *
   * `unknown` existe porque o gateway tem mais status do que a SPA — `incomplete`,
   * `unpaid`, `paused` — e mapeá-los à força para um dos quatro afirmaria algo que
   * não sabemos. Ninguém decide habilitação por este campo; ele é diagnóstico.
   */
  status: Subscription['status'] | 'unknown'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  /**
   * Um item por preço cobrado.
   *
   * `quantity` é o que a fatura cobra — e **não** o número de linhas que a
   * instalação usa. As duas divergem por construção quando há linha bonificada, e
   * é dessa diferença que a tela deriva "cobrada" × "bonificada".
   */
  items: GatewaySubscriptionItem[]
}

export type GatewaySubscriptionItem = {
  /** Price id do gateway — o `gatewayId` do plano. */
  priceId: string
  quantity: number
}
