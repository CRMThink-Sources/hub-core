import { Request } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { ListPlansController } from './list-plans.controller'
import { CreateCheckoutController } from './create-checkout.controller'
import { CreateBillingPortalController } from './create-billing-portal.controller'
import { ListOfferablePlans } from '@/modules/thinkzap/application/list-offerable-plans'
import { CreateSubscriptionCheckout } from '@/modules/thinkzap/application/create-subscription-checkout'
import { CreateBillingPortalSession } from '@/modules/thinkzap/application/create-billing-portal-session'
import type {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import type { Plan } from '@/modules/application/domain/entities/plan'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import type { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const NOW = new Date('2026-08-03T12:00:00.000Z')
const plusDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)

const product = {
  id: '42',
  name: 'ThinkZap',
  billingModel: 'subscription',
  active: true,
}

/** O plano do conector não oficial: a linha de teste do arquivo é Z-API. */
const PAID: Plan = {
  id: '7',
  name: 'Pro (não oficial)',
  product,
  amount: 4990,
  interval: 'monthly',
  gatewayId: 'price_paid',
  provider: 'ZAPI',
  active: true,
}
/** O do oficial, mais caro — e incompatível com uma linha Z-API. */
const PAID_OFFICIAL: Plan = {
  ...PAID,
  id: '8',
  name: 'Pro (oficial)',
  amount: 23700,
  gatewayId: 'price_official',
  provider: 'HUBMESSAGE',
}
/** Grátis por construção: sem price id no gateway, e sem conector a precificar. */
const TRIAL: Plan = {
  ...PAID,
  id: '1',
  name: 'Teste',
  amount: 0,
  gatewayId: undefined,
  provider: undefined,
}
const INACTIVE: Plan = { ...PAID, id: '9', name: 'Antigo', active: false }
/**
 * Pago, ativo, com price id — e **sem** provider. Não ofertável de propósito: sem
 * saber o que ele precifica não há como impedir a linha errada de contratá-lo.
 */
const PAID_WITHOUT_PROVIDER: Plan = {
  ...PAID,
  id: '10',
  name: 'Pago sem provider',
  provider: undefined,
}

const aplication = {
  id: 'app-1',
  spaId: '512',
  customer: {
    id: 'domain-1',
    name: 'acme.bitrix24.com.br',
    memberId: 'member-1',
  },
  appCode: 'crmthink.thinkzap',
  title: 'ThinkZap — Acme',
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
}

const line: SubscriptionItem = {
  id: '77',
  name: 'WhatsApp',
  subscription: '21',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
}

const subscriptionOf = (overrides: {
  status: Subscription['status']
  modality: Subscription['modality']
  plan?: Plan
  gatewayId?: string
  items?: SubscriptionItem[]
}): SubscriptionWithItems => ({
  id: '21',
  name: 'Assinatura',
  plan: overrides.plan ?? PAID,
  status: overrides.status,
  currentPeriodStart: plusDays(-5),
  currentPeriodEnd: plusDays(25),
  aplication,
  modality: overrides.modality,
  gatewayId: overrides.gatewayId,
  items: overrides.items ?? [line],
})

const makeContext = (subscriptions: SubscriptionWithItems[]) =>
  ({
    execute: vi.fn(
      (): Promise<AplicationContext> =>
        Promise.resolve({
          customer: aplication.customer as never,
          aplication,
          subscriptions,
        }),
    ),
  }) as unknown as GetAplicationContext

const makePlanRepository = (plans: Plan[]) =>
  ({
    getPlan: vi.fn(),
    getPlans: vi.fn(() => Promise.resolve(plans)),
  }) as unknown as PlanRepository

const makeGateway = () => {
  const createCheckoutSession = vi.fn(() =>
    Promise.resolve({ clientSecret: 'cs_test_embedded_secret' }),
  )
  const createBillingPortalSession = vi.fn(() =>
    Promise.resolve({ url: 'https://portal.example/session' }),
  )

  const syncSubscriptionLineItems = vi.fn(() => Promise.resolve())

  return {
    gateway: {
      verifyWebhookEvent: vi.fn(),
      createCheckoutSession,
      syncSubscriptionLineItems,
      createBillingPortalSession,
    } as unknown as PaymentGateway,
    createCheckoutSession,
    createBillingPortalSession,
    syncSubscriptionLineItems,
  }
}

const req = (body: unknown = {}) =>
  ({
    body,
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

describe('GET /thinkzap/plans', () => {
  /**
   * Sem contexto: a listagem deixou de ser filtrada pela instalação quando providers
   * misturados passaram a ser precificáveis. O parâmetro de assinaturas segue no
   * `makeController` só onde o teste ainda fala de instalação, e é ignorado aqui de
   * propósito — é o que prova que a resposta não depende dela.
   */
  const makeController = (
    plans: Plan[],
    _subscriptions: SubscriptionWithItems[] = [],
  ) =>
    new ListPlansController(new ListOfferablePlans(makePlanRepository(plans)))

  it('devolve o plano pago compatível, com nome, valor, intervalo e provider', async () => {
    const response = await makeController([PAID]).perform(req())

    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      plans: [
        {
          id: '7',
          name: 'Pro (não oficial)',
          amount: 4990,
          interval: 'monthly',
          provider: 'ZAPI',
        },
      ],
    })
  })

  /**
   * A listagem devolve o catálogo, e não o subconjunto que a instalação usa hoje: é
   * dela que a tela tira as duas opções de conector do botão de nova linha, e
   * filtrar pelo que já existe esconderia justamente a opção que o cliente quer
   * criar.
   *
   * O casamento entre plano e conector não desapareceu — mudou de lugar: é
   * verificado por linha, no checkout e na criação, onde há uma linha concreta a
   * comparar (ver `recusa o plano do outro conector` abaixo).
   */
  it('oferta o plano dos dois conectores para uma instalação com linha Z-API', async () => {
    const response = await makeController([PAID, PAID_OFFICIAL]).perform(req())

    expect(
      (response.result as { plans: Array<{ id: string }> }).plans.map(
        p => p.id,
      ),
    ).toEqual(['7', '8'])
  })

  /** Plano sem price id não tem o que cobrar. */
  it('não oferta plano de trial', async () => {
    expect(await makeController([TRIAL]).perform(req())).toMatchObject({
      result: { plans: [] },
    })
  })

  it('não oferta plano inativo', async () => {
    expect(await makeController([INACTIVE]).perform(req())).toMatchObject({
      result: { plans: [] },
    })
  })

  /** Falha fechada: sem saber o que precifica, não há como impedir o uso errado. */
  it('não oferta plano pago sem provider', async () => {
    expect(
      await makeController([PAID_WITHOUT_PROVIDER]).perform(req()),
    ).toMatchObject({ result: { plans: [] } })
  })

  it('oferta os dois planos quando a instalação não tem linha', async () => {
    const withoutLines = subscriptionOf({
      status: 'trialing',
      modality: 'manual',
      plan: TRIAL,
      items: [],
    })

    const response = await makeController(
      [PAID, PAID_OFFICIAL],
      [withoutLines],
    ).perform(req())

    expect(
      (response.result as { plans: Array<{ id: string }> }).plans.map(
        p => p.id,
      ),
    ).toEqual(['7', '8'])
  })

  /**
   * Era o estado não precificável, e deixou de ser: com um `line_item` por plano na
   * assinatura do gateway, a instalação com os dois conectores é cobrada pelos dois
   * preços. Esconder metade do catálogo dela impediria justamente o caso que criar
   * linha adicional existe para atender.
   */
  it('oferta os dois planos quando a instalação mistura conectores', async () => {
    const mixed = subscriptionOf({
      status: 'trialing',
      modality: 'manual',
      plan: TRIAL,
      items: [
        line,
        {
          ...line,
          id: '78',
          metadata: {
            provider: 'HUBMESSAGE',
            hubmessageChannelId: 'chan-1',
            wabaId: 'waba-1',
          },
        },
      ],
    })

    const response = await makeController(
      [PAID, PAID_OFFICIAL],
      [mixed],
    ).perform(req())

    expect(
      (response.result as { plans: Array<{ id: string }> }).plans.map(
        p => p.id,
      ),
    ).toEqual(['7', '8'])
    expect(response.result).not.toHaveProperty('mixedProviders')
  })

  /** O price id não sai daqui: a tela manda o id do plano, não o preço. */
  it('não devolve o id do plano no gateway', async () => {
    const serialized = JSON.stringify(
      (await makeController([PAID]).perform(req())).result,
    )

    expect(serialized).not.toContain('price_paid')
    expect(serialized).not.toContain('gatewayId')
  })
})

describe('POST /thinkzap/subscription/checkout', () => {
  const makeController = (
    options: {
      plans?: Plan[]
      subscriptions?: SubscriptionWithItems[]
      /** Campos da SPA de planos, para o caso do pré-requisito ausente. */
      planFields?: Record<string, { type?: string }>
    } = {},
  ) => {
    const { gateway, createCheckoutSession } = makeGateway()

    const getCrmItemFields = vi.fn(() =>
      Promise.resolve({
        result: {
          fields:
            options.planFields ??
            ({ ufCrm89Provider: { type: 'string' } } as Record<
              string,
              { type?: string }
            >),
        },
      }),
    )

    return {
      controller: new CreateCheckoutController(
        new CreateSubscriptionCheckout(
          makeContext(
            options.subscriptions ?? [
              subscriptionOf({
                status: 'trialing',
                modality: 'manual',
                plan: TRIAL,
              }),
            ],
          ),
          new ListOfferablePlans(
            makePlanRepository(options.plans ?? [PAID, PAID_OFFICIAL, TRIAL]),
          ),
          gateway,
          { getCrmItemFields } as unknown as BitrixClient,
        ),
      ),
      createCheckoutSession,
      getCrmItemFields,
    }
  }

  it('cria a sessão com o price id do plano e devolve o segredo', async () => {
    const { controller, createCheckoutSession } = makeController()

    const response = await controller.perform(req({ planId: '7' }))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ clientSecret: 'cs_test_embedded_secret' })
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [{ priceId: 'price_paid', quantity: 1 }],
        installation: {
          domainId: 'domain-1',
          appCode: 'crmthink.thinkzap',
          planId: '7',
        },
        /** Contratar é converter o que existe: quem acrescenta linha tem rota própria. */
        intent: { kind: 'convert' },
      }),
    )
  })

  /** `quantity` sai do número de linhas do contrato, não do corpo. */
  it('deriva quantity do número de linhas ativas da instalação', async () => {
    const { controller, createCheckoutSession } = makeController({
      subscriptions: [
        subscriptionOf({
          status: 'trialing',
          modality: 'manual',
          plan: TRIAL,
          items: [
            line,
            { ...line, id: '78' },
            { ...line, id: '79', status: 'cancelled' },
          ],
        }),
      ],
    })

    await controller.perform(req({ planId: '7' }))

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [{ priceId: 'price_paid', quantity: 2 }],
      }),
    )
  })

  it('usa quantity 1 numa instalação sem linha', async () => {
    const { controller, createCheckoutSession } = makeController({
      subscriptions: [
        subscriptionOf({
          status: 'trialing',
          modality: 'manual',
          plan: TRIAL,
          items: [],
        }),
      ],
    })

    await controller.perform(req({ planId: '7' }))

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [{ priceId: 'price_paid', quantity: 1 }],
      }),
    )
  })

  /**
   * A mesma proteção da listagem, no corpo: um id que a tela não poderia ter
   * oferecido não pode ser contratado por requisição montada à mão. Sem isto o
   * filtro do `GET /plans` seria cosmético.
   */
  it('recusa o plano do outro conector, sem criar sessão', async () => {
    const { controller, createCheckoutSession } = makeController()

    const response = await controller.perform(req({ planId: '8' }))

    expect(response.status).toBe(400)
    expect(String((response.result as { error: string }).error)).toMatch(
      /mesmo conector/,
    )
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it('recusa plano pago sem provider', async () => {
    const { controller, createCheckoutSession } = makeController({
      plans: [PAID_WITHOUT_PROVIDER],
    })

    expect((await controller.perform(req({ planId: '10' }))).status).toBe(400)
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  /**
   * Dois conectores deixaram de ser estado não precificável: a sessão carrega um
   * `line_item` por plano, e cada conector é cobrado pelo preço dele. Era o `409` que
   * mandava falar com o suporte.
   */
  it('cobra os dois preços quando a instalação mistura conectores', async () => {
    const { controller, createCheckoutSession } = makeController({
      subscriptions: [
        subscriptionOf({
          status: 'trialing',
          modality: 'manual',
          plan: TRIAL,
          items: [
            line,
            {
              ...line,
              id: '78',
              metadata: {
                provider: 'HUBMESSAGE',
                hubmessageChannelId: 'chan-1',
                wabaId: 'waba-1',
              },
            },
          ],
        }),
      ],
    })

    const response = await controller.perform(req({ planId: '7' }))

    expect(response.status).toBe(200)
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [
          { priceId: 'price_paid', quantity: 1 },
          { priceId: 'price_official', quantity: 1 },
        ],
      }),
    )
  })

  /**
   * Sem o campo na SPA, todo plano pago resolve provider `undefined` e o checkout
   * ficaria vazio sem explicar por quê. O erro nomeia o campo.
   */
  it('falha nomeando o campo de provider quando ele não existe na SPA de planos', async () => {
    const { controller, createCheckoutSession } = makeController({
      planFields: { ufCrm89Value: { type: 'integer' } },
    })

    await expect(controller.perform(req({ planId: '7' }))).rejects.toThrow(
      /ufCrm89Provider/,
    )
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it('recusa plano sem gatewayId, sem criar sessão', async () => {
    const { controller, createCheckoutSession } = makeController()

    const response = await controller.perform(req({ planId: '1' }))

    expect(response.status).toBe(400)
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it('recusa plano inexistente com erro identificável', async () => {
    const { controller, createCheckoutSession } = makeController()

    const response = await controller.perform(req({ planId: 'inexistente' }))

    expect(response.status).toBe(400)
    expect(String((response.result as { error: string }).error)).toMatch(
      /não é ofertável/,
    )
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it('recusa plano inativo', async () => {
    const { controller, createCheckoutSession } = makeController({
      plans: [INACTIVE],
    })

    expect((await controller.perform(req({ planId: '9' }))).status).toBe(400)
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  /** Trocar de plano está fora de escopo. */
  it('recusa quando a instalação já tem assinatura paga do gateway', async () => {
    const { controller, createCheckoutSession } = makeController({
      subscriptions: [
        subscriptionOf({
          status: 'active',
          modality: 'stripe',
          gatewayId: 'sub_1',
        }),
      ],
    })

    const response = await controller.perform(req({ planId: '7' }))

    expect(response.status).toBe(409)
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  /** Paga cancelada volta a poder contratar: é o caso de reativação. */
  it('permite contratar quando a paga do gateway está cancelada', async () => {
    const { controller, createCheckoutSession } = makeController({
      subscriptions: [
        subscriptionOf({
          status: 'cancelled',
          modality: 'stripe',
          gatewayId: 'sub_1',
        }),
      ],
    })

    expect((await controller.perform(req({ planId: '7' }))).status).toBe(200)
    expect(createCheckoutSession).toHaveBeenCalled()
  })

  /**
   * O cliente não escolhe quanto paga: um corpo que traga preço, quantidade ou
   * período é **recusado**, não ignorado.
   */
  it.each([
    [{ planId: '7', amount: 1 }],
    [{ planId: '7', quantity: 50 }],
    [{ planId: '7', interval: 'yearly' }],
    [{ planId: '7', currentPeriodEnd: '2030-01-01' }],
  ])('recusa corpo com campo derivado no servidor (%j)', async body => {
    const { controller, createCheckoutSession } = makeController()

    const response = await controller.perform(req(body))

    expect(response.status).toBe(400)
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it('recusa corpo sem planId', async () => {
    const { controller } = makeController()

    expect((await controller.perform(req({}))).status).toBe(400)
  })
})

describe('POST /thinkzap/subscription/billing-portal', () => {
  const makeController = (subscriptions: SubscriptionWithItems[]) => {
    const { gateway, createBillingPortalSession } = makeGateway()

    return {
      controller: new CreateBillingPortalController(
        new CreateBillingPortalSession(
          makeContext(subscriptions),
          gateway,
          'https://front.example/thinkzap/conexoes',
        ),
      ),
      createBillingPortalSession,
    }
  }

  it('abre o portal para assinatura do gateway', async () => {
    const { controller, createBillingPortalSession } = makeController([
      subscriptionOf({
        status: 'active',
        modality: 'stripe',
        gatewayId: 'sub_1',
      }),
    ])

    const response = await controller.perform(req())

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ url: 'https://portal.example/session' })
    expect(createBillingPortalSession).toHaveBeenCalledWith({
      gatewaySubscriptionId: 'sub_1',
      returnUrl: 'https://front.example/thinkzap/conexoes',
    })
  })

  /** Não existe portal do gateway para assinatura que não é dele. */
  it('recusa assinatura manual com erro identificável', async () => {
    const { controller, createBillingPortalSession } = makeController([
      subscriptionOf({ status: 'active', modality: 'manual' }),
    ])

    const response = await controller.perform(req())

    expect(response.status).toBe(400)
    expect(String((response.result as { error: string }).error)).toMatch(
      /não é do gateway/,
    )
    expect(createBillingPortalSession).not.toHaveBeenCalled()
  })

  it('recusa quando não há assinatura', async () => {
    const { controller, createBillingPortalSession } = makeController([])

    expect((await controller.perform(req())).status).toBe(400)
    expect(createBillingPortalSession).not.toHaveBeenCalled()
  })

  it('recusa trial', async () => {
    const { controller, createBillingPortalSession } = makeController([
      subscriptionOf({ status: 'trialing', modality: 'manual', plan: TRIAL }),
    ])

    expect((await controller.perform(req())).status).toBe(400)
    expect(createBillingPortalSession).not.toHaveBeenCalled()
  })

  /** Espelho pela metade: sem id no gateway não há o que abrir. */
  it('recusa assinatura do gateway sem gatewayId espelhado', async () => {
    const { controller, createBillingPortalSession } = makeController([
      subscriptionOf({ status: 'active', modality: 'stripe' }),
    ])

    expect((await controller.perform(req())).status).toBe(400)
    expect(createBillingPortalSession).not.toHaveBeenCalled()
  })
})

/**
 * Nenhuma resposta desta superfície carrega segredo. A verificação é sobre o
 * payload serializado, não sobre os campos que lembramos de omitir — é o que pega
 * o campo novo que alguém adicionar sem pensar nisso.
 */
describe('a superfície de contratação não vaza credencial do gateway', () => {
  const FORBIDDEN = ['sk_', 'whsec_', 'cus_', 'price_', 'gatewayId']

  const trialOnly = [
    subscriptionOf({ status: 'trialing', modality: 'manual', plan: TRIAL }),
  ]

  it('nem na listagem de planos', async () => {
    const controller = new ListPlansController(
      new ListOfferablePlans(makePlanRepository([PAID])),
    )

    const serialized = JSON.stringify((await controller.perform(req())).result)

    for (const needle of FORBIDDEN) {
      expect(serialized).not.toContain(needle)
    }
  })

  it('nem na resposta do checkout', async () => {
    const { gateway } = makeGateway()
    const controller = new CreateCheckoutController(
      new CreateSubscriptionCheckout(
        makeContext([
          subscriptionOf({
            status: 'trialing',
            modality: 'manual',
            plan: TRIAL,
          }),
        ]),
        new ListOfferablePlans(makePlanRepository([PAID])),
        gateway,
        {
          getCrmItemFields: vi.fn(() =>
            Promise.resolve({
              result: { fields: { ufCrm89Provider: { type: 'string' } } },
            }),
          ),
        } as unknown as BitrixClient,
      ),
    )

    const serialized = JSON.stringify(
      (await controller.perform(req({ planId: '7' }))).result,
    )

    for (const needle of FORBIDDEN) {
      expect(serialized).not.toContain(needle)
    }
  })

  it('nem na resposta do portal', async () => {
    const { gateway } = makeGateway()
    const controller = new CreateBillingPortalController(
      new CreateBillingPortalSession(
        makeContext([
          subscriptionOf({
            status: 'active',
            modality: 'stripe',
            gatewayId: 'sub_1',
          }),
        ]),
        gateway,
        'https://front.example/thinkzap/conexoes',
      ),
    )

    const serialized = JSON.stringify((await controller.perform(req())).result)

    for (const needle of FORBIDDEN) {
      expect(serialized).not.toContain(needle)
    }
  })
})
