import {
  Subscription,
  SubscriptionModality,
} from '@/modules/application/domain/entities/subscription'

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
  /**
   * Opcional na entrada, obrigatório na entidade: ausente **omite** o campo do
   * payload e a leitura resolve `manual`. Quem cria assinatura do gateway informa
   * explicitamente — assumir na escrita faria um patch de status reescrever a
   * modalidade.
   */
  modality?: SubscriptionModality
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
  /**
   * Busca pelo id da assinatura no gateway de pagamento. `null` quando não existe.
   *
   * É a chave de idempotência do processamento de webhook: o gateway reentrega por
   * design, e é por este id que uma reentrega encontra a assinatura já no estado
   * final em vez de criar outra. Ausência é caso **normal** — um evento de ciclo
   * de vida pode chegar antes do `checkout.session.completed` que cria o espelho.
   */
  getSubscriptionByGatewayId(gatewayId: string): Promise<Subscription | null>
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>
  updateSubscription(
    id: string,
    patch: UpdateSubscriptionInput,
  ): Promise<Subscription>
}
