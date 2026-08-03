import { Subscription } from '@/modules/application/domain/entities/subscription'

/**
 * Entrada de criação. Usa `planId` em vez da entidade: exigir o plano inteiro
 * obrigaria o chamador a resolvê-lo antes, e o id é o que a SPA precisa.
 *
 * Não há `productId`: a SPA 1142 não tem campo de produto, e o produto cobrado é
 * o do plano.
 */
export interface CreateSubscriptionInput {
  name: string
  planId: string
  /**
   * Id do item espelho da aplicação na SPA 1060 — **não** o uuid de
   * `core_apps`. É o valor que vai no campo parent da SPA de assinaturas, então
   * aplicação sem espelho (`spaId` nulo) não pode receber assinatura.
   */
  aplicationSpaId: string
  status: Subscription['status']
  currentPeriodStart: Date
  currentPeriodEnd: Date
  gatewayId?: string
}

/**
 * Patch parcial. `aplicationSpaId` fica fora de propósito — mover uma assinatura
 * para outra instalação é operação de negócio, não edição de campo.
 */
export type UpdateSubscriptionInput = Partial<
  Omit<CreateSubscriptionInput, 'aplicationSpaId'>
>

/**
 * Contrato único: leitura e escrita na mesma interface. Não há consumidor
 * só-leitura hoje que justifique segregar — quando aparecer, extrair a
 * interface menor é refactor local.
 */
export interface SubscriptionRepository {
  getSubscription(id: string): Promise<Subscription>
  getSubscriptions(): Promise<Subscription[]>
  /**
   * Filtra pelo campo parent da SPA de aplicação (`parentId1060`), então recebe
   * o `spaId` da aplicação. A visão por cliente é derivada em
   * `CustomerRepository.getCustomerProducts`.
   */
  getSubscriptionsByAplication(aplicationSpaId: string): Promise<Subscription[]>
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>
  updateSubscription(
    id: string,
    patch: UpdateSubscriptionInput,
  ): Promise<Subscription>
}
