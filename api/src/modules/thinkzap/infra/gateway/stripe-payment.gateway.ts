import Stripe from 'stripe'
import { env } from '@/config/env'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import {
  CreateBillingPortalSessionInput,
  CheckoutIntent,
  CheckoutSession,
  CreateCheckoutSessionInput,
  GatewayEvent,
  GatewayInstallationRef,
  GatewaySignatureError,
  PaymentGateway,
  SyncSubscriptionLineItemsInput,
} from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '../../errors/catalog'

/**
 * Status do Stripe → status da SPA.
 *
 * `incomplete`, `incomplete_expired` e `unpaid` caem em `past_due`: são todos
 * "cobrança não fechou", e a linha bloqueia igual. `paused` também bloqueia —
 * assinatura pausada não é serviço prestado.
 *
 * Status desconhecido **não** entra num default: um mapa parcial que assumisse
 * `active` destravaria linha por um status novo do gateway, e assumir `cancelled`
 * cortaria cliente pagante. Fora deste mapa o evento é ignorado com log.
 */
const STATUS_BY_STRIPE_STATUS: Record<string, Subscription['status']> = {
  active: 'active',
  trialing: 'active',
  past_due: 'past_due',
  unpaid: 'past_due',
  incomplete: 'past_due',
  incomplete_expired: 'past_due',
  paused: 'past_due',
  canceled: 'cancelled',
}

/** Os três eventos tratados. Qualquer outro é `ignored`. */
const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export class StripeNotConfiguredError extends Error {
  constructor(missing: string) {
    super(
      `Stripe não configurado: ${missing} está vazio. A contratação self-service ` +
        'fica indisponível; a modalidade boleto não depende disto.',
    )
    this.name = 'StripeNotConfiguredError'
  }
}

export class StripeWrongKeyTypeError extends Error {
  constructor(prefix: string) {
    super(
      `STRIPE_SECRET_KEY tem a chave errada: começa com "${prefix}", que é a chave ` +
        '**publicável**. O servidor precisa da secret key (`sk_`) ou de uma restrita ' +
        '(`rk_`). A publicável é a do front, em NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.',
    )
    this.name = 'StripeWrongKeyTypeError'
  }
}

/**
 * Recusa chave do tipo errado no construtor.
 *
 * Comprimento não distingue: `pk_test_…` e `sk_test_…` têm o mesmo tamanho. Sem esta
 * checagem, a publicável passa por "configurado" e o erro aparece **no Stripe**, no
 * meio de uma contratação, como "cannot be made with a publishable API key" — longe
 * da causa e depois de já ter ido à rede.
 *
 * Só o prefixo entra na mensagem. O resto da chave nunca é registrado: log é
 * exatamente onde credencial não deve acabar.
 */
function assertServerKey(secretKey: string): void {
  if (secretKey.startsWith('sk_') || secretKey.startsWith('rk_')) return

  throw new StripeWrongKeyTypeError(secretKey.slice(0, 3))
}

/**
 * Adapter do Stripe.
 *
 * **Não é chamado do caminho quente de mensagem.** As leituras que ele faz
 * (`subscriptions.retrieve`) acontecem só no processamento de webhook e na
 * contratação, onde a latência de um terceiro é aceitável — diferente de cada
 * mensagem recebida, onde ela seria multiplicada por todo o tráfego.
 */
export class StripePaymentGateway implements PaymentGateway {
  private readonly stripe: Stripe

  constructor(
    secretKey: string = env.payments.stripe.secretKey,
    private readonly webhookSecret: string = env.payments.stripe.webhookSecret,
  ) {
    if (!secretKey) throw new StripeNotConfiguredError('STRIPE_SECRET_KEY')
    assertServerKey(secretKey)

    this.stripe = new Stripe(secretKey)
  }

  async verifyWebhookEvent(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<GatewayEvent> {
    /**
     * Segredo ausente é recusa, não passe livre: sem validação qualquer um
     * postaria um `checkout.session.completed` forjado e destravaria uma linha
     * sem pagar.
     */
    if (!this.webhookSecret) {
      throw new GatewaySignatureError('STRIPE_WEBHOOK_SECRET não configurado')
    }

    if (!signature) {
      throw new GatewaySignatureError('cabeçalho stripe-signature ausente')
    }

    let event: Stripe.Event
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      )
    } catch (error) {
      throw new GatewaySignatureError(
        error instanceof Error ? error.message : 'falha na validação',
      )
    }

    if (!HANDLED_EVENTS.has(event.type)) {
      return { type: 'ignored', name: event.type }
    }

    return this.normalize(event)
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession> {
    if (input.lineItems.length === 0) {
      throw new Error(
        'Checkout sem nenhum preço a cobrar: a sessão não teria o que faturar',
      )
    }

    const metadata = this.toMetadata(input.installation, input.intent)

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      /**
       * Embedado, não hospedado: o app vive no iframe do Bitrix, e a página
       * hospedada não monta em contexto de terceiro — trava nos placeholders sem
       * montar o formulário. Neste modo `success_url` e `cancel_url` não são aceitos.
       *
       * `embedded_page`, não `embedded`: o valor antigo foi descontinuado. E o tipo
       * `UiMode` do SDK termina em `OtherString`, para tolerar valores novos da API —
       * o que significa que **o compilador não pega** um valor inválido aqui. Só a
       * chamada real reclama.
       */
      ui_mode: 'embedded_page',
      /**
       * Sem redirecionamento: o SDK avisa a conclusão por callback e a nossa tela
       * decide o que mostrar. Com o default (`always`) o Stripe navegaria o frame
       * dele para uma `return_url` — mais uma navegação dentro de um iframe que já
       * está aninhado, e nenhum ganho, já que quem observa a ativação é a tela.
       *
       * `return_url` **não** pode ser enviada junto: a API recusa as duas.
       */
      redirect_on_completion: 'never',
      /**
       * Um item por plano a cobrar. Com linhas de conectores diferentes são dois,
       * cada um com a quantidade do conector dele — é o que permite cobrar os dois
       * preços na mesma assinatura, em vez de multiplicar um só.
       */
      line_items: input.lineItems.map(item => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      /**
       * O mesmo metadata nos dois lugares: a sessão o carrega para o
       * `checkout.session.completed`, e a assinatura o carrega para os eventos de
       * ciclo de vida. Sem o segundo, um `customer.subscription.updated` não teria
       * como voltar à instalação se o espelho na SPA falhasse.
       */
      metadata,
      subscription_data: { metadata },
    })

    if (!session.client_secret) {
      throw new Error(
        'Stripe não devolveu o client_secret da sessão de checkout embedada',
      )
    }

    return { clientSecret: session.client_secret }
  }

  /**
   * Leva os itens da assinatura ao estado desejado, sem checkout.
   *
   * Preço que já tem item **atualiza a quantidade**; preço novo **entra como item
   * novo**. Preço ausente da lista não é tocado: reduzir cobrança é cancelar linha,
   * operação própria — e um `items` completo com `deleted: true` implícito apagaria
   * a cobrança de linhas que continuam existindo.
   *
   * Uma chamada só, com todos os itens: duas chamadas gerariam duas faturas
   * proporcionais para uma única mudança do cliente.
   *
   * `proration_behavior` fica no default do gateway. A política própria de crédito
   * proporcional é decisão que o produto ainda não tomou, e inventá-la aqui
   * esconderia isso.
   */
  async syncSubscriptionLineItems(
    input: SyncSubscriptionLineItemsInput,
  ): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(
      input.gatewaySubscriptionId,
    )

    const itemByPrice = new Map(
      subscription.items.data.map(item => [item.price.id, item]),
    )

    const items = input.lineItems.map(desired => {
      const existing = itemByPrice.get(desired.priceId)

      return existing
        ? { id: existing.id, quantity: desired.quantity }
        : { price: desired.priceId, quantity: desired.quantity }
    })

    /**
     * Nada a mudar: toda quantidade desejada já é a atual. Devolver sem ir à rede
     * é o que faz a operação ser segura de repetir — o gateway aceitaria a chamada,
     * mas cada uma dessas idas gera avaliação de proration por nada.
     */
    const unchanged = input.lineItems.every(
      desired =>
        itemByPrice.get(desired.priceId)?.quantity === desired.quantity,
    )
    if (unchanged) return

    await this.stripe.subscriptions.update(input.gatewaySubscriptionId, {
      items,
    })
  }

  async createBillingPortalSession(
    input: CreateBillingPortalSessionInput,
  ): Promise<{ url: string }> {
    /**
     * O id do cliente é resolvido a partir da assinatura, no servidor. A tela
     * nunca vê nem manda id de cliente do gateway — se mandasse, mandar o de
     * outra instalação abriria o portal alheio.
     */
    const subscription = await this.stripe.subscriptions.retrieve(
      input.gatewaySubscriptionId,
    )

    const customer =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id

    const session = await this.stripe.billingPortal.sessions.create({
      customer,
      return_url: input.returnUrl,
    })

    return { url: session.url }
  }

  private async normalize(event: Stripe.Event): Promise<GatewayEvent> {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object

      const gatewaySubscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id

      const installation = this.readInstallation(session.metadata)

      /**
       * Sessão sem assinatura ou sem metadata não é nossa para processar: pode ser
       * checkout de pagamento único, ou uma sessão criada fora deste fluxo.
       * Ignorada com log em vez de erro — falhar faria o gateway reentregar em
       * backoff por algo que nunca vai completar.
       */
      if (!gatewaySubscriptionId || !installation) {
        logThinkzapError(
          apiLogger,
          'thinkzap.gateway.event_ignored',
          {
            app: 'thinkzap',
            event: event.type,
            gatewaySubscriptionId,
            hasInstallation: Boolean(installation),
          },
          {
            level: 'warn',
            msg: 'checkout.session.completed sem assinatura ou sem metadata de instalação — ignorando',
          },
        )
        return { type: 'ignored', name: event.type }
      }

      /**
       * O período vem da assinatura, que a sessão não carrega. É uma leitura ao
       * gateway, no caminho de webhook — não no de mensagem.
       */
      const subscription = await this.stripe.subscriptions.retrieve(
        gatewaySubscriptionId,
      )
      const period = this.readPeriod(subscription)

      return {
        type: 'checkout.completed',
        gatewaySubscriptionId,
        installation,
        intent: this.readIntent(session.metadata),
        ...period,
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      return {
        type: 'subscription.deleted',
        gatewaySubscriptionId: event.data.object.id,
      }
    }

    const subscription = event.data.object as Stripe.Subscription
    const status = STATUS_BY_STRIPE_STATUS[subscription.status]

    if (!status) {
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.event_ignored',
        {
          app: 'thinkzap',
          event: event.type,
          gatewaySubscriptionId: subscription.id,
          gatewayStatus: subscription.status,
        },
        {
          level: 'warn',
          msg: 'Status de assinatura do gateway desconhecido — ignorando o evento',
        },
      )
      return { type: 'ignored', name: event.type }
    }

    return {
      type: 'subscription.updated',
      gatewaySubscriptionId: subscription.id,
      status,
      totalLineQuantity: (subscription.items?.data ?? []).reduce(
        (total, item) => total + (item.quantity ?? 0),
        0,
      ),
      ...this.readPeriod(subscription),
    }
  }

  /**
   * O metadata da instalação, ou `null` quando incompleto.
   *
   * Os três campos juntos ou nada: com `domainId` sem `appCode` não há instalação
   * a resolver, e adivinhar o app code ativaria a assinatura no app errado.
   */
  private readInstallation(
    metadata: Stripe.Metadata | null,
  ): GatewayInstallationRef | null {
    const domainId = metadata?.domainId
    const appCode = metadata?.appCode
    const planId = metadata?.planId

    if (!domainId || !appCode || !planId) return null

    return { domainId, appCode, planId }
  }

  /**
   * A intenção da sessão, ou `convert`.
   *
   * O default **preserva o comportamento anterior**: sessão criada antes deste
   * deploy não tem o campo, e ler ausência como `add-line` faria uma contratação
   * comum criar uma linha que ninguém pediu. Intenção `add-line` sem provider ou
   * sem plano também cai em `convert`, pelo mesmo motivo — metadata pela metade não
   * autoriza provisionar recurso.
   */
  private readIntent(metadata: Stripe.Metadata | null): CheckoutIntent {
    if (metadata?.intent !== 'add-line') return { kind: 'convert' }

    const provider = metadata.newLineProvider
    const planId = metadata.newLinePlanId

    if ((provider !== 'ZAPI' && provider !== 'HUBMESSAGE') || !planId) {
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.event_ignored',
        { app: 'thinkzap', provider, hasPlanId: Boolean(planId) },
        {
          level: 'warn',
          msg: 'Sessão declarou intenção de acrescentar linha sem conector ou sem plano — tratada como contratação comum',
        },
      )
      return { kind: 'convert' }
    }

    return { kind: 'add-line', provider, planId }
  }

  private toMetadata(
    installation: GatewayInstallationRef,
    intent: CheckoutIntent,
  ): Stripe.MetadataParam {
    return {
      domainId: installation.domainId,
      appCode: installation.appCode,
      planId: installation.planId,
      intent: intent.kind,
      /**
       * Chaves só no caminho que as usa: o metadata do gateway é um mapa plano de
       * strings, e gravar `null` deixaria a leitura sem como distinguir "não é
       * add-line" de "é add-line com campo vazio".
       */
      ...(intent.kind === 'add-line'
        ? { newLineProvider: intent.provider, newLinePlanId: intent.planId }
        : {}),
    }
  }

  /**
   * O período da assinatura, tolerante a **onde** o Stripe o coloca.
   *
   * `current_period_start/end` viveram na assinatura e passaram a viver no item de
   * linha nas versões novas da API. Ler só um dos dois lugares deixaria o período
   * indefinido dependendo da versão de API da conta — e período inválido reprova o
   * item inteiro no mapper da SPA, o que apareceria como "pagou e a linha não
   * voltou".
   */
  private readPeriod(subscription: Stripe.Subscription): {
    currentPeriodStart: Date
    currentPeriodEnd: Date
  } {
    const item = subscription.items?.data?.[0] as
      | { current_period_start?: number; current_period_end?: number }
      | undefined

    const legacy = subscription as unknown as {
      current_period_start?: number
      current_period_end?: number
    }

    const start = legacy.current_period_start ?? item?.current_period_start
    const end = legacy.current_period_end ?? item?.current_period_end

    if (!start || !end) {
      logThinkzapError(
        apiLogger,
        'thinkzap.gateway.period_missing',
        { app: 'thinkzap', gatewaySubscriptionId: subscription.id },
        { level: 'warn' },
      )
      throw new Error(
        `Assinatura ${subscription.id} do gateway não trouxe período de cobrança`,
      )
    }

    return {
      currentPeriodStart: new Date(start * 1000),
      currentPeriodEnd: new Date(end * 1000),
    }
  }
}
