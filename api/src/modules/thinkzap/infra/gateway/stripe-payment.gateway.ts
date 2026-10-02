import Stripe from 'stripe'
import { env } from '@/config/env'
import { GatewaySubscription } from '@/modules/application/domain/entities/gateway-subscription'
import { Subscription } from '@/modules/application/domain/entities/subscription'
import {
  PlanPrice,
  PriceRecurrence,
  TieringMode,
} from '@/modules/thinkzap/domain/plan-pricing'
import {
  CreateBillingPortalSessionInput,
  CheckoutIntent,
  CheckoutSession,
  CreateCheckoutSessionInput,
  GatewayEvent,
  GatewayInstallationRef,
  GatewayPriceUnreadableError,
  GatewaySignatureError,
  GatewaySubscriptionUnreadableError,
  PaymentGateway,
  SyncSubscriptionLineItemsInput,
} from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError, thinkzapError } from '../../errors/catalog'
import {
  SubscriptionPeriod,
  readSubscriptionPeriod,
} from './read-subscription-period'

// Decide habilitação. Sem default: `active` destravaria linha e `cancelled` cortaria pagante; fora do mapa, ignora com log.
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

// Só diagnóstico, por isso não achata `paused`/`unpaid`; fora do mapa vira `unknown`.
const STATUS_BY_STRIPE_STATUS_DIAGNOSTIC: Record<
  string,
  GatewaySubscription['status']
> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'cancelled',
}

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

// Sem isto a chave publicável só falha no Stripe, no meio da contratação. Só o prefixo vai pro log.
function assertServerKey(secretKey: string): void {
  if (secretKey.startsWith('sk_') || secretKey.startsWith('rk_')) return

  throw new StripeWrongKeyTypeError(secretKey.slice(0, 3))
}

const RECURRENCE_INTERVALS: readonly PriceRecurrence['interval'][] = [
  'day',
  'week',
  'month',
  'year',
]

// Nunca chamar do caminho quente de mensagem: a latência do Stripe só cabe em webhook e contratação.
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
    // Segredo ausente recusa: senão um evento forjado destravaria linha sem pagar.
    if (!this.webhookSecret) {
      throw thinkzapError('thinkzap.gateway.webhook_secret_missing')
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
      // Hospedado não monta no iframe do Bitrix. `embedded` foi descontinuado e o tipo do SDK não pega valor inválido.
      ui_mode: 'embedded_page',
      // A tela observa a conclusão por callback; a API recusa `return_url` junto.
      redirect_on_completion: 'never',
      line_items: input.lineItems.map(item => ({
        price: item.priceId,
        quantity: item.quantity,
      })),
      // Também na assinatura: eventos de ciclo de vida precisam voltar à instalação.
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

  // Preço fora da lista não é tocado (reduzir é cancelar linha). Uma chamada só: duas gerariam duas faturas proporcionais.
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

    // Evita update vazio, que dispararia avaliação de proration à toa.
    const unchanged = input.lineItems.every(
      desired =>
        itemByPrice.get(desired.priceId)?.quantity === desired.quantity,
    )
    if (unchanged) return

    await this.stripe.subscriptions.update(input.gatewaySubscriptionId, {
      items,
    })
  }

  // Não `subscriptions.cancel()`: cortaria na hora o período já pago.
  async cancelSubscriptionAtPeriodEnd(
    gatewaySubscriptionId: string,
  ): Promise<void> {
    await this.stripe.subscriptions.update(gatewaySubscriptionId, {
      cancel_at_period_end: true,
    })
  }

  async createBillingPortalSession(
    input: CreateBillingPortalSessionInput,
  ): Promise<{ url: string }> {
    // Cliente resolvido no servidor: id vindo da tela abriria portal alheio.
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

  // `expand: ['tiers']` obrigatório: price escalonado vem sem `unit_amount` e os degraus não vêm por padrão.
  async readPrice(priceId: string): Promise<PlanPrice> {
    let price: Stripe.Price
    try {
      price = await this.stripe.prices.retrieve(priceId, {
        expand: ['tiers'],
      })
    } catch (error) {
      throw new GatewayPriceUnreadableError(
        priceId,
        error instanceof Error ? error.message : String(error),
      )
    }

    const recurrence = this.readRecurrence(price)
    const currency = price.currency

    if (price.billing_scheme === 'tiered') {
      if (!price.tiers || price.tiers.length === 0) {
        throw new GatewayPriceUnreadableError(
          priceId,
          'price escalonado veio sem os degraus (tiers). Sem eles não há valor a ' +
            'exibir, e tratar como sem preço esconderia o plano por causa errada',
        )
      }

      return {
        kind: 'tiered',
        currency,
        recurrence,
        mode: this.readTieringMode(priceId, price.tiers_mode),
        tiers: price.tiers.map(tier => ({
          upTo: typeof tier.up_to === 'number' ? tier.up_to : null,
          unitAmount: tier.unit_amount ?? 0,
        })),
      }
    }

    if (price.unit_amount == null) {
      throw new GatewayPriceUnreadableError(
        priceId,
        `price com billing_scheme "${price.billing_scheme}" e sem unit_amount`,
      )
    }

    return { kind: 'unit', currency, recurrence, unitAmount: price.unit_amount }
  }

  // Item sem price é descartado: pode ser cobrança que não é linha.
  async readSubscription(
    gatewaySubscriptionId: string,
  ): Promise<GatewaySubscription> {
    let subscription: Stripe.Subscription
    try {
      subscription = await this.stripe.subscriptions.retrieve(
        gatewaySubscriptionId,
      )
    } catch (error) {
      throw new GatewaySubscriptionUnreadableError(
        gatewaySubscriptionId,
        error instanceof Error ? error.message : String(error),
      )
    }

    const period = readSubscriptionPeriod(subscription)
    if (!period) {
      throw new GatewaySubscriptionUnreadableError(
        gatewaySubscriptionId,
        'assinatura veio sem período de cobrança, nem na raiz nem nos itens',
      )
    }

    return {
      status:
        STATUS_BY_STRIPE_STATUS_DIAGNOSTIC[subscription.status] ?? 'unknown',
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      items: subscription.items.data.flatMap(item => {
        const priceId = item.price?.id
        if (!priceId) return []

        return [{ priceId, quantity: item.quantity ?? 0 }]
      }),
    }
  }

  private readRecurrence(price: Stripe.Price): PriceRecurrence {
    if (!price.recurring) {
      throw new GatewayPriceUnreadableError(
        price.id,
        'price não é recorrente, e a assinatura precisa de um que seja',
      )
    }

    // União aberta no SDK (`OtherString`): cast aceitaria intervalo desconhecido em silêncio.
    const interval = RECURRENCE_INTERVALS.find(
      candidate => candidate === price.recurring?.interval,
    )

    if (!interval) {
      throw new GatewayPriceUnreadableError(
        price.id,
        `intervalo de recorrência "${price.recurring.interval}" não é reconhecido`,
      )
    }

    return { interval, intervalCount: price.recurring.interval_count }
  }

  // Modo desconhecido recusa: `undefined` cobraria o degrau errado calado.
  private readTieringMode(
    priceId: string,
    mode: Stripe.Price.TiersMode | null,
  ): TieringMode {
    if (mode === 'graduated' || mode === 'volume') return mode

    throw new GatewayPriceUnreadableError(
      priceId,
      `tiers_mode "${mode ?? '(ausente)'}" não é suportado — os modos calculáveis ` +
        'são graduated e volume',
    )
  }

  private async normalize(event: Stripe.Event): Promise<GatewayEvent> {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object

      const gatewaySubscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id

      const installation = this.readInstallation(session.metadata)

      // Ignora em vez de falhar: erro faria o gateway reentregar algo que nunca completa.
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

  private readInstallation(
    metadata: Stripe.Metadata | null,
  ): GatewayInstallationRef | null {
    const domainId = metadata?.domainId
    const appCode = metadata?.appCode
    const planId = metadata?.planId

    if (!domainId || !appCode || !planId) return null

    return { domainId, appCode, planId }
  }

  // Na dúvida, `convert`: metadata ausente ou pela metade não autoriza provisionar linha.
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
      ...(intent.kind === 'add-line'
        ? { newLineProvider: intent.provider, newLinePlanId: intent.planId }
        : {}),
    }
  }

  // No webhook, período ausente lança (pagamento não espelhável); o backfill só pula.
  private readPeriod(subscription: Stripe.Subscription): SubscriptionPeriod {
    const period = readSubscriptionPeriod(subscription)

    if (!period) {
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

    return period
  }
}
