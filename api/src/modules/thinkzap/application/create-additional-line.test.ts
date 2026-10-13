import { describe, expect, it, vi } from 'vitest'
import {
  CreateAdditionalLine,
  ManualModalityCannotCreateLineError,
  NoLineToExtendError,
  PlanDoesNotPriceProviderError,
} from './create-additional-line'
import {
  PlanForProviderAmbiguousError,
  PlanForProviderMissingError,
} from './helpers/build-contract-line-items'
import { ProvisionedResourceWithoutCredentialError } from './helpers/line-resource-metadata'
import { ListOfferablePlans } from './list-offerable-plans'
import { ProviderResourceBilling } from './provider-resource-billing'
import { apiLogger } from '@/shared/infra/logger'
import type {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import type { Plan } from '@/modules/application/domain/entities/plan'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import type {
  CreateSubscriptionInput,
  SubscriptionRepository,
} from '@/modules/application/domain/repositories/subscription.repository'
import type { CreateSubscriptionItemInput } from '@/modules/application/domain/repositories/subscription-item.repository'
import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import type { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import type { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

/**
 * Espelho do recurso: dublê que aceita tudo. O que ele grava é afirmado nos testes de
 * `saveResourceMirror` e do repositório Redis; aqui ele existe para o fluxo não depender
 * de Redis.
 */
const MIRRORS_DOUBLE = {
  find: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve()),
  setBillingState: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
}

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

const TRIAL_PLAN: Plan = {
  id: '1',
  name: 'Teste',
  product,
  amount: 0,
  interval: 'monthly',
  active: true,
}

const ZAPI_PLAN: Plan = {
  id: '7',
  name: 'Pro',
  product,
  amount: 4990,
  interval: 'monthly',
  gatewayId: 'price_zapi',
  provider: 'ZAPI',
  active: true,
}

const HUB_PLAN: Plan = {
  ...ZAPI_PLAN,
  id: '8',
  name: 'Pro Oficial',
  gatewayId: 'price_hub',
  provider: 'HUBMESSAGE',
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

const zapiLine: SubscriptionItem = {
  id: '77',
  name: 'WhatsApp',
  subscription: '99',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: 'chan-9',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
}

/** Contrato pago vivo no gateway: uma linha Z-API, plano Z-API. */
const paidContract = (
  overrides: Partial<SubscriptionWithItems> = {},
): SubscriptionWithItems => ({
  id: '99',
  name: 'Pro — ThinkZap — Acme',
  plan: ZAPI_PLAN,
  status: 'active',
  currentPeriodStart: NOW,
  currentPeriodEnd: plusDays(30),
  aplication,
  modality: 'stripe',
  gatewayId: 'sub_1',
  items: [zapiLine],
  ...overrides,
})

/** Trial: sem `gatewayId`, e a modalidade lida resolve `manual` por ausência. */
const trialContract = (
  overrides: Partial<SubscriptionWithItems> = {},
): SubscriptionWithItems => ({
  id: '21',
  name: 'Teste — Acme',
  plan: TRIAL_PLAN,
  status: 'trialing',
  currentPeriodStart: plusDays(-1),
  currentPeriodEnd: plusDays(2),
  aplication,
  modality: 'manual',
  items: [zapiLine],
  ...overrides,
})

const INPUT = {
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  provider: 'HUBMESSAGE' as const,
  planId: '8',
}

type Options = {
  subscriptions?: SubscriptionWithItems[]
  catalog?: Plan[]
  spaId?: string | null
  failProvision?: boolean
  failSync?: boolean
  failCreateItem?: boolean
  /** Provisionamento conclui sem credencial — linha que nunca conectaria. */
  provisionWithoutCredential?: boolean
}

const makeUseCase = (options: Options = {}) => {
  const context: AplicationContext = {
    customer: aplication.customer as never,
    aplication: {
      ...aplication,
      spaId: 'spaId' in options ? options.spaId! : '512',
    },
    subscriptions: options.subscriptions ?? [paidContract()],
  }

  const getAplicationContext = {
    execute: vi.fn(() => Promise.resolve(context)),
  } as unknown as GetAplicationContext

  const getPlans = vi.fn(() =>
    Promise.resolve(options.catalog ?? [ZAPI_PLAN, HUB_PLAN, TRIAL_PLAN]),
  )
  const plans = new ListOfferablePlans({
    getPlan: vi.fn(),
    getPlans,
  } as unknown as PlanRepository)

  const createCheckoutSession = vi.fn(() =>
    Promise.resolve({ clientSecret: 'cs_secret' }),
  )
  const syncSubscriptionLineItems = vi.fn(() =>
    options.failSync
      ? Promise.reject(new Error('gateway fora'))
      : Promise.resolve(),
  )
  const gateway = {
    verifyWebhookEvent: vi.fn(),
    createCheckoutSession,
    syncSubscriptionLineItems,
    createBillingPortalSession: vi.fn(),
  } as unknown as PaymentGateway

  const createSubscription = vi.fn((input: CreateSubscriptionInput) =>
    Promise.resolve({
      ...paidContract(),
      id: '100',
      plan: HUB_PLAN,
      status: input.status,
    }),
  )
  const subscriptions = {
    getSubscription: vi.fn(),
    getSubscriptions: vi.fn(),
    getSubscriptionsByAplication: vi.fn(),
    listSubscriptionsByGatewayId: vi.fn(),
    createSubscription,
    updateSubscription: vi.fn(),
  } as unknown as SubscriptionRepository

  const createSubscriptionItem = vi.fn((input: CreateSubscriptionItemInput) =>
    options.failCreateItem
      ? Promise.reject(new Error('crm.item.add falhou'))
      : Promise.resolve({
          ...zapiLine,
          id: '90',
          name: input.name,
          subscription: input.subscription,
          metadata: input.metadata,
        }),
  )
  const items = {
    getSubscriptionItem: vi.fn(),
    getSubscriptionItems: vi.fn(),
    getSubscriptionItemsBySubscription: vi.fn(),
    createSubscriptionItem,
    updateSubscriptionItem: vi.fn(),
    reparentSubscriptionItem: vi.fn(),
  } as unknown as SubscriptionItemRepository

  const provisionConnector = vi.fn(() => {
    if (options.failProvision) return Promise.reject(new Error('provider fora'))

    return Promise.resolve(
      options.provisionWithoutCredential
        ? { instanceId: 'inst-2', status: 'created' }
        : {
            instanceId: 'inst-2',
            status: 'created',
            zApiToken: 'tok-2',
            channelId: 'chan-2',
            wabaId: 'waba-2',
          },
    )
  })
  const resolve = vi.fn(() => ({ provisionConnector }))
  const providerResolver = { resolve } as unknown as ConnectorProviderResolver

  const subscribe = vi.fn(() => Promise.resolve())
  const providerBilling = {
    subscribe,
    unsubscribe: vi.fn(),
  } as unknown as ProviderResourceBilling

  return {
    useCase: new CreateAdditionalLine(
      getAplicationContext,
      plans,
      gateway,
      subscriptions,
      items,
      providerResolver,
      providerBilling,
      MIRRORS_DOUBLE,
    ),
    createCheckoutSession,
    syncSubscriptionLineItems,
    createSubscription,
    createSubscriptionItem,
    provisionConnector,
    subscribe,
  }
}

describe('CreateAdditionalLine', () => {
  describe('guardas', () => {
    it('recusa instalação sem nenhuma linha, nomeando o trial', async () => {
      const deps = makeUseCase({
        subscriptions: [trialContract({ items: [] })],
      })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow(
        NoLineToExtendError,
      )
      expect(deps.provisionConnector).not.toHaveBeenCalled()
      expect(deps.syncSubscriptionLineItems).not.toHaveBeenCalled()
    })

    /** Boleto é mantido por fora: ajustar `line_items` não existe para ele. */
    it('recusa a modalidade manual', async () => {
      const deps = makeUseCase({
        subscriptions: [paidContract({ modality: 'manual' })],
      })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow(
        ManualModalityCannotCreateLineError,
      )
      expect(deps.provisionConnector).not.toHaveBeenCalled()
    })

    /**
     * O trial nasce sem o campo de modalidade, e a leitura tolerante resolve
     * `manual` para ele. A checagem invertida recusaria justamente quem está
     * testando.
     */
    it('não confunde trial com boleto', async () => {
      const deps = makeUseCase({ subscriptions: [trialContract()] })

      await expect(deps.useCase.execute(INPUT)).resolves.toMatchObject({
        kind: 'checkout',
      })
    })

    it('recusa plano que não precifica o conector pedido', async () => {
      const deps = makeUseCase()

      await expect(
        deps.useCase.execute({ ...INPUT, planId: '7' }),
      ).rejects.toThrow(PlanDoesNotPriceProviderError)
      expect(deps.provisionConnector).not.toHaveBeenCalled()
    })

    it('recusa plano de trial, que não tem o que cobrar', async () => {
      const deps = makeUseCase()

      await expect(
        deps.useCase.execute({ ...INPUT, planId: '1' }),
      ).rejects.toThrow(PlanDoesNotPriceProviderError)
    })

    /** Configuração ausente na SPA de planos, nomeada como tal. */
    it('recusa quando o conector da linha existente não tem plano', async () => {
      const deps = makeUseCase({ catalog: [HUB_PLAN] })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow(
        PlanForProviderMissingError,
      )
      expect(deps.provisionConnector).not.toHaveBeenCalled()
    })

    /**
     * Escolher entre dois planos do mesmo conector cobraria o preço de um pelo uso
     * do outro, em silêncio. A recusa nomeia os candidatos.
     */
    it('recusa quando o conector da linha existente tem dois planos', async () => {
      const deps = makeUseCase({
        catalog: [ZAPI_PLAN, { ...ZAPI_PLAN, id: '70' }, HUB_PLAN],
      })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow(
        PlanForProviderAmbiguousError,
      )
    })

    /** A ambiguidade do conector **novo** não bloqueia: o plano dele foi escolhido. */
    it('cria mesmo quando o conector novo tem dois planos ofertáveis', async () => {
      const deps = makeUseCase({
        catalog: [ZAPI_PLAN, HUB_PLAN, { ...HUB_PLAN, id: '80' }],
      })

      await expect(deps.useCase.execute(INPUT)).resolves.toMatchObject({
        kind: 'created',
      })
    })
  })

  describe('caminho sem checkout (contrato vivo no gateway)', () => {
    it('provisiona, ajusta a cobrança, cria a linha e assina no provider', async () => {
      const deps = makeUseCase()

      const result = await deps.useCase.execute(INPUT)

      expect(result).toMatchObject({ kind: 'created' })
      expect(deps.createCheckoutSession).not.toHaveBeenCalled()
      expect(deps.syncSubscriptionLineItems).toHaveBeenCalledWith({
        gatewaySubscriptionId: 'sub_1',
        lineItems: [
          { priceId: 'price_zapi', quantity: 1 },
          { priceId: 'price_hub', quantity: 1 },
        ],
      })
      expect(deps.subscribe).toHaveBeenCalledTimes(1)
    })

    /** Estado desejado, não incremento: a segunda linha do mesmo plano vira `2`. */
    it('manda a quantidade final do plano quando a linha é do mesmo conector', async () => {
      const deps = makeUseCase()

      await deps.useCase.execute({ ...INPUT, provider: 'ZAPI', planId: '7' })

      expect(deps.syncSubscriptionLineItems).toHaveBeenCalledWith({
        gatewaySubscriptionId: 'sub_1',
        lineItems: [{ priceId: 'price_zapi', quantity: 2 }],
      })
    })

    /**
     * A primeira linha de um conector novo **não** cria assinatura: a cobrança dele
     * nasce como um `line_item` novo no gateway, que é onde o preço vive, e a linha é
     * precificada pelo plano do conector dela na composição — não pelo plano da
     * assinatura que a hospeda.
     */
    it('a linha do conector novo nasce na assinatura vigente, sem criar assinatura', async () => {
      const deps = makeUseCase()

      await deps.useCase.execute(INPUT)

      expect(deps.createSubscription).not.toHaveBeenCalled()
      expect(deps.createSubscriptionItem).toHaveBeenCalledWith(
        expect.objectContaining({ subscription: '99' }),
      )
    })

    it('a linha do conector que já tem linha nasce na mesma assinatura', async () => {
      const deps = makeUseCase()

      await deps.useCase.execute({ ...INPUT, provider: 'ZAPI', planId: '7' })

      expect(deps.createSubscription).not.toHaveBeenCalled()
      expect(deps.createSubscriptionItem).toHaveBeenCalledWith(
        expect.objectContaining({ subscription: '99' }),
      )
    })

    /**
     * Contrato criado pela forma anterior: a linha cai na vigente, e nenhuma outra
     * nasce. A composição continua certa porque conta o contrato inteiro por conector.
     */
    it('contrato com irmãs pré-existentes recebe a linha sem criar outra', async () => {
      const deps = makeUseCase({
        subscriptions: [
          paidContract(),
          paidContract({ id: '100', plan: HUB_PLAN, items: [] }),
        ],
      })

      await deps.useCase.execute(INPUT)

      expect(deps.createSubscription).not.toHaveBeenCalled()
      expect(deps.createSubscriptionItem).toHaveBeenCalledWith(
        expect.objectContaining({ subscription: '99' }),
      )
    })

    /** O entitlement é do pai, e o pai é a assinatura vigente do contrato. */
    it('contrato inadimplente hospeda a linha nova do mesmo jeito', async () => {
      const deps = makeUseCase({
        subscriptions: [paidContract({ status: 'past_due' })],
      })

      await deps.useCase.execute(INPUT)

      expect(deps.createSubscription).not.toHaveBeenCalled()
      expect(deps.createSubscriptionItem).toHaveBeenCalledWith(
        expect.objectContaining({ subscription: '99' }),
      )
    })

    it('grava a credencial provisionada no item', async () => {
      const deps = makeUseCase()

      await deps.useCase.execute(INPUT)

      expect(deps.createSubscriptionItem).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          metadata: {
            provider: 'HUBMESSAGE',
            hubmessageChannelId: 'chan-2',
            wabaId: 'waba-2',
          },
        }),
      )
    })
  })

  describe('ordem obrigatória', () => {
    it('falha ao provisionar não cobra nada', async () => {
      const deps = makeUseCase({ failProvision: true })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow('provider fora')

      expect(deps.syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(deps.createSubscriptionItem).not.toHaveBeenCalled()
    })

    /**
     * Linha sem credencial nunca conectaria, e o cliente teria pago por ela.
     *
     * O caso é o token da Z-API: para o WhatsApp Oficial a credencial de criação é o
     * **canal**, e a WABA vem depois — exigi-la aqui tornava a linha oficial
     * impossível de criar.
     */
    it('provisionamento sem credencial aborta antes de cobrar', async () => {
      const deps = makeUseCase({ provisionWithoutCredential: true })

      await expect(
        deps.useCase.execute({ ...INPUT, provider: 'ZAPI', planId: '7' }),
      ).rejects.toThrow(ProvisionedResourceWithoutCredentialError)
      expect(deps.syncSubscriptionLineItems).not.toHaveBeenCalled()
    })

    /** O canal basta: a WABA chega quando o cliente conectar o número na Meta. */
    it('linha oficial nasce com o canal e sem WABA', async () => {
      const deps = makeUseCase({ provisionWithoutCredential: true })

      await deps.useCase.execute(INPUT)

      expect(deps.createSubscriptionItem).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'inst-2' },
        }),
      )
    })

    it('falha na cobrança registra o recurso órfão e não cria a linha', async () => {
      const deps = makeUseCase({ failSync: true })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow('gateway fora')

      expect(deps.createSubscriptionItem).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ orphanRemoteId: 'chan-2' }),
        expect.stringMatching(/recurso órfão/),
      )
    })

    /**
     * O risco concentrado: cobrança feita e linha faltando. O log carrega os ids que
     * a criação manual exige, porque não há compensação automática.
     */
    it('falha ao criar o item registra tudo o que a recuperação manual exige', async () => {
      const deps = makeUseCase({ failCreateItem: true })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow(
        'crm.item.add falhou',
      )

      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewaySubscriptionId: 'sub_1',
          planId: '8',
          provider: 'HUBMESSAGE',
          remoteId: 'chan-2',
        }),
        expect.stringMatching(/cliente pagou e não tem a linha/),
      )
      expect(deps.subscribe).not.toHaveBeenCalled()
    })
  })

  describe('caminho de checkout (sem contrato vivo no gateway)', () => {
    it('cobra a linha do trial junto com a nova, e não provisiona antes de pagar', async () => {
      const deps = makeUseCase({ subscriptions: [trialContract()] })

      const result = await deps.useCase.execute(INPUT)

      expect(result).toEqual({ kind: 'checkout', clientSecret: 'cs_secret' })
      expect(deps.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          lineItems: [
            { priceId: 'price_zapi', quantity: 1 },
            { priceId: 'price_hub', quantity: 1 },
          ],
          intent: { kind: 'add-line', provider: 'HUBMESSAGE', planId: '8' },
        }),
      )
      expect(deps.provisionConnector).not.toHaveBeenCalled()
      expect(deps.createSubscriptionItem).not.toHaveBeenCalled()
      expect(deps.syncSubscriptionLineItems).not.toHaveBeenCalled()
    })

    /** Cancelada não existe mais no gateway: não há `line_item` a ajustar. */
    it('assinatura paga cancelada volta para o checkout', async () => {
      const deps = makeUseCase({
        subscriptions: [paidContract({ status: 'cancelled' })],
      })

      await expect(deps.useCase.execute(INPUT)).resolves.toMatchObject({
        kind: 'checkout',
      })
    })

    /** Inadimplente existe no gateway: acrescentar é ajuste, não contratação nova. */
    it('assinatura inadimplente segue pelo ajuste de cobrança', async () => {
      const deps = makeUseCase({
        subscriptions: [paidContract({ status: 'past_due' })],
      })

      await expect(deps.useCase.execute(INPUT)).resolves.toMatchObject({
        kind: 'created',
      })
    })
  })

  describe('as linhas que já existem', () => {
    /**
     * Nenhuma escrita atinge o item anterior: credencial, ajustes e canal vinculado
     * são a linha do cliente, e uma operação de cobrança não os toca.
     */
    it('não são tocadas pela criação', async () => {
      const deps = makeUseCase()

      await deps.useCase.execute(INPUT)

      const written = deps.createSubscriptionItem.mock.calls.map(
        call => call[0],
      )

      /**
       * Uma escrita só, e é a da linha nova. O item que já existia fica onde está:
       * a criação **acrescenta** um item à assinatura do contrato, e não reescreve
       * os que ela já hospedava.
       */
      expect(written).toHaveLength(1)
      expect(written[0]?.metadata).toMatchObject({ provider: 'HUBMESSAGE' })
    })
  })
})
