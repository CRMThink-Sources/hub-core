import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  StripeNotConfiguredError,
  StripePaymentGateway,
  StripeWrongKeyTypeError,
} from './stripe-payment.gateway'
import { GatewayPriceUnreadableError } from '@/modules/thinkzap/domain/ports/payment-gateway.port'

/**
 * Só o que o teste inspeciona dos parâmetros da sessão. Declarar o shape em vez de
 * dublar com `any` é o que permite afirmar `line_items` e `metadata` sem que cada
 * asserção passe a ser acesso a `any`.
 */
type SessionParams = {
  line_items: Array<{ price: string; quantity: number }>
  metadata: Record<string, string | undefined>
  subscription_data: { metadata: Record<string, string | undefined> }
}

type GatewaySubscriptionFake = {
  id: string
  status: string
  current_period_start: number
  current_period_end: number
  items: {
    data: Array<{ id: string; price: { id: string }; quantity: number }>
  }
}

type UpdateParams = {
  items: Array<{ id?: string; price?: string; quantity: number }>
}

/**
 * Dublê do SDK com as três superfícies que o adapter usa. `vi.hoisted` porque o
 * `vi.mock` sobe para o topo do módulo e não veria um `const` declarado depois — os
 * tipos acima não precisam disso, porque TS os iça por conta própria.
 */
const stripeFake = vi.hoisted(() => ({
  createSession:
    vi.fn<
      (params: SessionParams) => Promise<{ client_secret: string | null }>
    >(),
  retrieveSubscription:
    vi.fn<(id: string) => Promise<GatewaySubscriptionFake>>(),
  updateSubscription:
    vi.fn<(id: string, params: UpdateParams) => Promise<unknown>>(),
  constructEvent: vi.fn<() => { type: string; data: { object: unknown } }>(),
  retrievePrice:
    vi.fn<(id: string, params?: { expand?: string[] }) => Promise<unknown>>(),
}))

vi.mock('stripe', () => ({
  default: class {
    constructor(readonly key: string) {}

    checkout = { sessions: { create: stripeFake.createSession } }
    subscriptions = {
      retrieve: stripeFake.retrieveSubscription,
      update: stripeFake.updateSubscription,
    }
    webhooks = { constructEvent: stripeFake.constructEvent }
    prices = { retrieve: stripeFake.retrievePrice }
  },
}))

/**
 * O logger é dublado, não o `env`: dublar `env` exigiria reproduzir o que o logger
 * lê dele (nível, destino), e o teste passaria a depender daquele formato. As chaves
 * chegam por argumento em todos os casos abaixo, então o `env` real não é consultado.
 */
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

/**
 * Só a validação de chave do construtor. As chamadas ao gateway não são exercitadas
 * aqui: dependem da API do Stripe, e o valor deste teste é impedir que chave do tipo
 * errado passe por "configurado".
 */
describe('StripePaymentGateway — chave do servidor', () => {
  it('aceita secret key', () => {
    expect(
      () => new StripePaymentGateway('sk_test_123', 'whsec_1'),
    ).not.toThrow()
  })

  it('aceita chave restrita', () => {
    expect(
      () => new StripePaymentGateway('rk_test_123', 'whsec_1'),
    ).not.toThrow()
  })

  /**
   * O erro real: a publicável foi para `STRIPE_SECRET_KEY`. Comprimento não distingue
   * — `pk_test_…` e `sk_test_…` têm o mesmo tamanho — então sem esta checagem ela
   * passa e o Stripe recusa no meio de uma contratação.
   */
  it('recusa a chave publicável', () => {
    expect(() => new StripePaymentGateway('pk_test_123', 'whsec_1')).toThrow(
      StripeWrongKeyTypeError,
    )
  })

  it('a mensagem aponta a variável certa para a publicável', () => {
    expect(() => new StripePaymentGateway('pk_test_123', 'whsec_1')).toThrow(
      /NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/,
    )
  })

  /** Credencial não vai para log nem para mensagem de erro. */
  it('não vaza a chave na mensagem', () => {
    try {
      new StripePaymentGateway('pk_test_segredo_que_nao_pode_aparecer', 'w')
      expect.unreachable('deveria ter lançado')
    } catch (error) {
      expect((error as Error).message).not.toContain('segredo_que_nao_pode')
      expect((error as Error).message).toContain('pk_')
    }
  })

  it('recusa chave vazia antes de checar o tipo', () => {
    expect(() => new StripePaymentGateway('', 'whsec_1')).toThrow(
      StripeNotConfiguredError,
    )
  })
})

const INSTALLATION = {
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  planId: '7',
}

const makeGateway = () => new StripePaymentGateway('sk_test_123', 'whsec_1')

/** Assinatura do gateway com os itens que o teste precisa. */
const gatewaySubscription = (
  items: Array<{ id: string; priceId: string; quantity: number }>,
) => ({
  id: 'sub_1',
  status: 'active',
  current_period_start: 1_760_000_000,
  current_period_end: 1_762_000_000,
  items: {
    data: items.map(item => ({
      id: item.id,
      price: { id: item.priceId },
      quantity: item.quantity,
    })),
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  stripeFake.createSession.mockResolvedValue({ client_secret: 'cs_secret' })
})

describe('createCheckoutSession', () => {
  it('manda um line_item por plano a cobrar', async () => {
    await makeGateway().createCheckoutSession({
      lineItems: [
        { priceId: 'price_zapi', quantity: 2 },
        { priceId: 'price_hub', quantity: 1 },
      ],
      installation: INSTALLATION,
      intent: { kind: 'convert' },
    })

    expect(stripeFake.createSession.mock.calls[0]![0].line_items).toEqual([
      { price: 'price_zapi', quantity: 2 },
      { price: 'price_hub', quantity: 1 },
    ])
  })

  /** Sessão sem preço não teria o que faturar, e o gateway recusaria mais longe. */
  it('recusa checkout sem nenhum preço', async () => {
    await expect(
      makeGateway().createCheckoutSession({
        lineItems: [],
        installation: INSTALLATION,
        intent: { kind: 'convert' },
      }),
    ).rejects.toThrow(/sem nenhum preço/)

    expect(stripeFake.createSession).not.toHaveBeenCalled()
  })

  it('carrega a intenção de acrescentar linha nos dois metadata', async () => {
    await makeGateway().createCheckoutSession({
      lineItems: [{ priceId: 'price_zapi', quantity: 1 }],
      installation: INSTALLATION,
      intent: { kind: 'add-line', provider: 'HUBMESSAGE', planId: '9' },
    })

    const params = stripeFake.createSession.mock.calls[0]![0]
    const expected = {
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
      planId: '7',
      intent: 'add-line',
      newLineProvider: 'HUBMESSAGE',
      newLinePlanId: '9',
    }

    expect(params.metadata).toEqual(expected)
    expect(params.subscription_data.metadata).toEqual(expected)
  })

  /**
   * Metadata é mapa plano de strings: gravar as chaves da linha nova numa
   * contratação comum deixaria a leitura sem como distinguir "não é add-line" de
   * "é add-line com campo vazio".
   */
  it('não grava campos de linha nova numa contratação comum', async () => {
    await makeGateway().createCheckoutSession({
      lineItems: [{ priceId: 'price_zapi', quantity: 1 }],
      installation: INSTALLATION,
      intent: { kind: 'convert' },
    })

    const { metadata } = stripeFake.createSession.mock.calls[0]![0]

    expect(metadata.intent).toBe('convert')
    expect(metadata).not.toHaveProperty('newLineProvider')
    expect(metadata).not.toHaveProperty('newLinePlanId')
  })
})

describe('syncSubscriptionLineItems', () => {
  it('atualiza a quantidade do item que já existe, pelo id dele', async () => {
    stripeFake.retrieveSubscription.mockResolvedValue(
      gatewaySubscription([{ id: 'si_1', priceId: 'price_zapi', quantity: 1 }]),
    )

    await makeGateway().syncSubscriptionLineItems({
      gatewaySubscriptionId: 'sub_1',
      lineItems: [{ priceId: 'price_zapi', quantity: 2 }],
    })

    expect(stripeFake.updateSubscription).toHaveBeenCalledWith('sub_1', {
      items: [{ id: 'si_1', quantity: 2 }],
    })
  })

  it('acrescenta item para preço que ainda não está na assinatura', async () => {
    stripeFake.retrieveSubscription.mockResolvedValue(
      gatewaySubscription([{ id: 'si_1', priceId: 'price_zapi', quantity: 1 }]),
    )

    await makeGateway().syncSubscriptionLineItems({
      gatewaySubscriptionId: 'sub_1',
      lineItems: [
        { priceId: 'price_zapi', quantity: 1 },
        { priceId: 'price_hub', quantity: 1 },
      ],
    })

    expect(stripeFake.updateSubscription).toHaveBeenCalledWith('sub_1', {
      items: [
        { id: 'si_1', quantity: 1 },
        { price: 'price_hub', quantity: 1 },
      ],
    })
  })

  /**
   * Estado desejado, não incremento: a mesma chamada repetida não muda nada. É o
   * que torna duplo clique inofensivo do lado da cobrança.
   */
  it('não vai à rede quando a quantidade desejada já é a atual', async () => {
    stripeFake.retrieveSubscription.mockResolvedValue(
      gatewaySubscription([{ id: 'si_1', priceId: 'price_zapi', quantity: 2 }]),
    )

    await makeGateway().syncSubscriptionLineItems({
      gatewaySubscriptionId: 'sub_1',
      lineItems: [{ priceId: 'price_zapi', quantity: 2 }],
    })

    expect(stripeFake.updateSubscription).not.toHaveBeenCalled()
  })

  /** Reduzir cobrança é cancelar linha, não efeito colateral de acrescentar outra. */
  it('não remove o item do preço ausente da lista', async () => {
    stripeFake.retrieveSubscription.mockResolvedValue(
      gatewaySubscription([
        { id: 'si_1', priceId: 'price_zapi', quantity: 1 },
        { id: 'si_2', priceId: 'price_hub', quantity: 1 },
      ]),
    )

    await makeGateway().syncSubscriptionLineItems({
      gatewaySubscriptionId: 'sub_1',
      lineItems: [{ priceId: 'price_zapi', quantity: 2 }],
    })

    const { items } = stripeFake.updateSubscription.mock.calls[0]![1]

    expect(items).toEqual([{ id: 'si_1', quantity: 2 }])
    expect(JSON.stringify(items)).not.toContain('deleted')
  })
})

describe('normalização do evento', () => {
  const event = (type: string, object: unknown) => {
    stripeFake.constructEvent.mockReturnValue({ type, data: { object } })
    return makeGateway().verifyWebhookEvent(Buffer.from('{}'), 'sig')
  }

  const session = (metadata: Record<string, string>) => ({
    subscription: 'sub_1',
    metadata,
  })

  it('lê a intenção de acrescentar linha do metadata da sessão', async () => {
    stripeFake.retrieveSubscription.mockResolvedValue(gatewaySubscription([]))

    const result = await event(
      'checkout.session.completed',
      session({
        ...INSTALLATION,
        intent: 'add-line',
        newLineProvider: 'ZAPI',
        newLinePlanId: '9',
      }),
    )

    expect(result).toMatchObject({
      type: 'checkout.completed',
      intent: { kind: 'add-line', provider: 'ZAPI', planId: '9' },
    })
  })

  /**
   * Sessão de um deploy anterior não tem o campo. Ler ausência como `add-line`
   * faria uma contratação comum criar linha que ninguém pediu.
   */
  it('sessão sem intenção é lida como contratação comum', async () => {
    stripeFake.retrieveSubscription.mockResolvedValue(gatewaySubscription([]))

    const result = await event(
      'checkout.session.completed',
      session(INSTALLATION),
    )

    expect(result).toMatchObject({ intent: { kind: 'convert' } })
  })

  /** Metadata pela metade não autoriza provisionar recurso. */
  it('intenção de acrescentar sem conector cai em contratação comum', async () => {
    stripeFake.retrieveSubscription.mockResolvedValue(gatewaySubscription([]))

    const result = await event(
      'checkout.session.completed',
      session({ ...INSTALLATION, intent: 'add-line', newLinePlanId: '9' }),
    )

    expect(result).toMatchObject({ intent: { kind: 'convert' } })
  })

  it('soma as quantidades dos line_items no evento de atualização', async () => {
    const result = await event(
      'customer.subscription.updated',
      gatewaySubscription([
        { id: 'si_1', priceId: 'price_zapi', quantity: 2 },
        { id: 'si_2', priceId: 'price_hub', quantity: 1 },
      ]),
    )

    expect(result).toMatchObject({
      type: 'subscription.updated',
      status: 'active',
      totalLineQuantity: 3,
    })
  })
})

/**
 * Tradução do price para o vocabulário do domínio. O que estes casos protegem é o
 * caminho em que o preço **existe** e não chega: `tiers` não vem por padrão na API, e
 * um escalonado sem degraus se parece com plano gratuito.
 */
describe('StripePaymentGateway — leitura de preço', () => {
  const gateway = () => new StripePaymentGateway('sk_test_123', 'whsec_1')

  const recurringMonthly = {
    interval: 'month',
    interval_count: 1,
    usage_type: 'licensed',
  }

  beforeEach(() => {
    stripeFake.retrievePrice.mockReset()
  })

  it('pede os degraus expandidos', async () => {
    stripeFake.retrievePrice.mockResolvedValue({
      id: 'price_1',
      currency: 'brl',
      billing_scheme: 'per_unit',
      unit_amount: 9900,
      recurring: recurringMonthly,
    })

    await gateway().readPrice('price_1')

    expect(stripeFake.retrievePrice).toHaveBeenCalledWith('price_1', {
      expand: ['tiers'],
    })
  })

  it('traduz price de valor único', async () => {
    stripeFake.retrievePrice.mockResolvedValue({
      id: 'price_1',
      currency: 'brl',
      billing_scheme: 'per_unit',
      unit_amount: 9900,
      recurring: recurringMonthly,
    })

    await expect(gateway().readPrice('price_1')).resolves.toEqual({
      kind: 'unit',
      currency: 'brl',
      recurrence: { interval: 'month', intervalCount: 1 },
      unitAmount: 9900,
    })
  })

  /** Os degraus reais do WhatsApp Web em produção. */
  it('traduz price escalonado graduated', async () => {
    stripeFake.retrievePrice.mockResolvedValue({
      id: 'price_web',
      currency: 'brl',
      billing_scheme: 'tiered',
      tiers_mode: 'graduated',
      unit_amount: null,
      recurring: recurringMonthly,
      tiers: [
        { up_to: 1, unit_amount: 28700 },
        { up_to: null, unit_amount: 18700 },
      ],
    })

    await expect(gateway().readPrice('price_web')).resolves.toEqual({
      kind: 'tiered',
      currency: 'brl',
      recurrence: { interval: 'month', intervalCount: 1 },
      mode: 'graduated',
      tiers: [
        { upTo: 1, unitAmount: 28700 },
        { upTo: null, unitAmount: 18700 },
      ],
    })
  })

  /** Os degraus reais do WhatsApp Business em produção. */
  it('traduz price escalonado volume', async () => {
    stripeFake.retrievePrice.mockResolvedValue({
      id: 'price_biz',
      currency: 'brl',
      billing_scheme: 'tiered',
      tiers_mode: 'volume',
      unit_amount: null,
      recurring: recurringMonthly,
      tiers: [
        { up_to: 1, unit_amount: 25700 },
        { up_to: null, unit_amount: 18700 },
      ],
    })

    await expect(gateway().readPrice('price_biz')).resolves.toMatchObject({
      kind: 'tiered',
      mode: 'volume',
    })
  })

  /**
   * O caso que motiva o `expand`: sem degraus, o price não tem valor nenhum. Falhar
   * nomeando o price é o que separa "chamada incompleta" de "plano sem preço".
   */
  it('recusa escalonado sem degraus expandidos', async () => {
    stripeFake.retrievePrice.mockResolvedValue({
      id: 'price_web',
      currency: 'brl',
      billing_scheme: 'tiered',
      tiers_mode: 'graduated',
      unit_amount: null,
      recurring: recurringMonthly,
    })

    await expect(gateway().readPrice('price_web')).rejects.toThrow(
      GatewayPriceUnreadableError,
    )
    await expect(gateway().readPrice('price_web')).rejects.toThrow('price_web')
  })

  it('recusa tiers_mode desconhecido em vez de tratar como não escalonado', async () => {
    stripeFake.retrievePrice.mockResolvedValue({
      id: 'price_x',
      currency: 'brl',
      billing_scheme: 'tiered',
      tiers_mode: 'by_moon_phase',
      unit_amount: null,
      recurring: recurringMonthly,
      tiers: [{ up_to: null, unit_amount: 100 }],
    })

    await expect(gateway().readPrice('price_x')).rejects.toThrow(
      GatewayPriceUnreadableError,
    )
  })

  it('recusa price não recorrente', async () => {
    stripeFake.retrievePrice.mockResolvedValue({
      id: 'price_once',
      currency: 'brl',
      billing_scheme: 'per_unit',
      unit_amount: 9900,
      recurring: null,
    })

    await expect(gateway().readPrice('price_once')).rejects.toThrow(
      GatewayPriceUnreadableError,
    )
  })

  /**
   * `interval` é união **aberta** no SDK, então um valor novo do gateway chegaria
   * tipado e passaria por válido num cast.
   */
  it('recusa intervalo de recorrência desconhecido', async () => {
    stripeFake.retrievePrice.mockResolvedValue({
      id: 'price_odd',
      currency: 'brl',
      billing_scheme: 'per_unit',
      unit_amount: 9900,
      recurring: { interval: 'fortnight', interval_count: 1 },
    })

    await expect(gateway().readPrice('price_odd')).rejects.toThrow(
      GatewayPriceUnreadableError,
    )
  })

  it('traduz falha de chamada em erro nomeando o price', async () => {
    stripeFake.retrievePrice.mockRejectedValue(
      new Error("No such price: 'price_ghost'"),
    )

    await expect(gateway().readPrice('price_ghost')).rejects.toThrow(
      GatewayPriceUnreadableError,
    )
  })
})
