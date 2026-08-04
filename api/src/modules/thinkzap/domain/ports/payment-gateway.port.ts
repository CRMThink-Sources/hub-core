import { Subscription } from '@/modules/application/domain/entities/subscription'

/**
 * Contrato neutro com o gateway de pagamento.
 *
 * Existe para que o caso de uso do webhook não conheça tipos do gateway: ele
 * recebe eventos já **normalizados**, com os campos que a SPA precisa e nada
 * mais. Sem isso, a decisão de negócio ("pagou → ativa") ficaria escrita em cima
 * do shape de um terceiro, e cada mudança de versão de API deles viraria mudança
 * no caso de uso.
 *
 * As implementações vivem em `infra` e NÃO devem vazar tipos do gateway.
 */

/** A instalação que um checkout pertence, carregada no metadata da sessão. */
export type GatewayInstallationRef = {
  /** Uuid de `core_domains`, como vem no JWT. */
  domainId: string
  /** `core_app_codes.id`, como vem no JWT. */
  appCode: string
  /** Id do item de plano na SPA de planos. */
  planId: string
}

/**
 * Evento do gateway, normalizado.
 *
 * Três tipos tratados, e só três (decisão 5 do design). Qualquer outro chega como
 * `ignored` — o gateway manda dezenas de tipos, e tratar evento desconhecido como
 * erro faria o gateway reentregar em backoff por algo que não nos diz nada.
 */
export type GatewayEvent =
  /** Pagamento concluído: é o que ativa a assinatura paga. */
  | {
      type: 'checkout.completed'
      /** Id da assinatura no gateway — a chave de idempotência de tudo. */
      gatewaySubscriptionId: string
      installation: GatewayInstallationRef
      currentPeriodStart: Date
      currentPeriodEnd: Date
    }
  /** Reflete pagamento recusado e recuperação. */
  | {
      type: 'subscription.updated'
      gatewaySubscriptionId: string
      status: Subscription['status']
      currentPeriodStart: Date
      currentPeriodEnd: Date
    }
  /** Cancelamento definitivo. */
  | { type: 'subscription.deleted'; gatewaySubscriptionId: string }
  /** Fora dos três: registrado e ignorado, com sucesso na resposta. */
  | { type: 'ignored'; name: string }

export type CreateCheckoutSessionInput = {
  /** Price id do gateway — o `gatewayId` do plano. */
  priceId: string
  /** Número de linhas da instalação. Hoje sempre 1. */
  quantity: number
  installation: GatewayInstallationRef
}

/**
 * Sessão de checkout **embedada**.
 *
 * `clientSecret` e não `url`: o app roda dentro do iframe do Bitrix, e a página
 * hospedada do gateway não funciona emoldurada — em contexto de terceiro o
 * navegador particiona o storage que ela precisa, e a tela trava nos placeholders
 * sem nunca montar o formulário. O modo embedado é o caminho suportado para esse
 * cenário: o segredo é montado pelo SDK na nossa própria tela.
 *
 * Sem URL de retorno: a sessão é criada com redirecionamento desligado, e o SDK
 * avisa a conclusão por callback. Assim nada navega — nem o iframe do Bitrix, nem o
 * frame do gateway dentro dele.
 */
export type CheckoutSession = {
  clientSecret: string
}

export type CreateBillingPortalSessionInput = {
  /** Id do cliente no gateway, resolvido no servidor a partir da assinatura. */
  gatewaySubscriptionId: string
  returnUrl: string
}

export class GatewaySignatureError extends Error {
  constructor(detail: string) {
    super(`Assinatura do evento do gateway inválida: ${detail}`)
    this.name = 'GatewaySignatureError'
  }
}

export interface PaymentGateway {
  /**
   * Valida a assinatura do evento sobre o corpo **cru** e devolve o evento
   * normalizado.
   *
   * Recebe `Buffer`, não objeto: a validação é um HMAC sobre os bytes exatos que
   * chegaram. Depois de `express.json()` o corpo foi reserializado e a assinatura
   * **sempre** falha.
   *
   * Lança `GatewaySignatureError` quando não confere — e não processa nada.
   */
  verifyWebhookEvent(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<GatewayEvent>

  /** Cria a sessão de checkout embedada e devolve o segredo que o SDK monta. */
  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession>

  /**
   * Cria a sessão do portal de faturamento e devolve a URL.
   *
   * URL, e não segredo embedável: o portal do gateway **não** tem modo embedado —
   * é página hospedada, e continua abrindo em aba própria.
   */
  createBillingPortalSession(
    input: CreateBillingPortalSessionInput,
  ): Promise<{ url: string }>
}
