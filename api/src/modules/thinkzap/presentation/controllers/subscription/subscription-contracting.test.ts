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

  return {
    gateway: {
      verifyWebhookEvent: vi.fn(),
      createCheckoutSession,
      createBillingPortalSession,
    } as unknown as PaymentGateway,
    createCheckoutSession,
    createBillingPortalSession,
  }
}

const req = (body: unknown = {}) =>
  ({
    body,
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

describe('GET /thinkzap/plans', () => {
  /** Por default a instalação tem uma linha Z-API (`line`). */
  const makeController = (
    plans: Plan[],
    subscriptions: SubscriptionWithItems[] = [
      subscriptionOf({ status: 'trialing', modality: 'manual', plan: TRIAL }),
    ],
  ) =>
    new ListPlansController(
      new ListOfferablePlans(makePlanRepository(plans)),
      makeContext(subscriptions),
    )

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
      mixedProviders: false,
    })
  })

  /**
   * O buraco que o campo de provider veio fechar: uma linha Z-API não pode ver o
   * plano do Oficial, senão contrata o preço errado para o que consome.
   */
  it('não oferta o plano do outro conector', async () => {
    expect(
      await makeController([PAID, PAID_OFFICIAL]).perform(req()),
    ).toMatchObject({
      result: { plans: [{ id: '7', provider: 'ZAPI' }] },
    })
  })

  it('oferta o plano do oficial para linha oficial', async () => {
    const official = subscriptionOf({
      status: 'trialing',
      modality: 'manual',
      plan: TRIAL,
      items: [
        {
          ...line,
          metadata: {
            provider: 'HUBMESSAGE',
            hubmessageChannelId: 'chan-1',
            wabaId: 'waba-1',
          },
        },
      ],
    })

    expect(
      await makeController([PAID, PAID_OFFICIAL], [official]).perform(req()),
    ).toMatchObject({
      result: { plans: [{ id: '8', provider: 'HUBMESSAGE' }] },
    })
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

  /** Sem linha não há conector em uso: nada a proteger, oferta tudo. */
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
   * Providers misturados: nenhum plano cobre, e a tela precisa distinguir isso de
   * "não há plano cadastrado" — só o primeiro pede contato com o suporte.
   */
  it('não oferta nada e sinaliza quando a instalação mistura conectores', async () => {
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

    expect(
      await makeController([PAID, PAID_OFFICIAL], [mixed]).perform(req()),
    ).toMatchObject({ result: { plans: [], mixedProviders: true } })
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

  it('cria a sessão com o price id do plano e devolve a URL', async () => {
    const { controller, createCheckoutSession } = makeController()

    const response = await controller.perform(req({ planId: '7' }))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ clientSecret: 'cs_test_embedded_secret' })
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_paid',
        quantity: 1,
        installation: {
          domainId: 'domain-1',
          appCode: 'crmthink.thinkzap',
          planId: '7',
        },
      }),
    )
  })

  /**
   * `quantity` sai do número de linhas, não do corpo. Hoje sempre 1, e o cálculo
   * existe para que "assinar" não precise ser reescrito quando a segunda linha
   * entrar.
   */
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
      expect.objectContaining({ quantity: 2 }),
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
      expect.objectContaining({ quantity: 1 }),
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

  /** Nenhum preço cobre dois conectores numa assinatura de um plano só. */
  it('recusa quando a instalação mistura conectores', async () => {
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

    expect(response.status).toBe(409)
    expect(createCheckoutSession).not.toHaveBeenCalled()
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
      makeContext(trialOnly),
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
