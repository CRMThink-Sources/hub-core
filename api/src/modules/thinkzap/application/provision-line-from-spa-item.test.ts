import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiLogger } from '@/shared/infra/logger'
import type {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import type { Plan } from '@/modules/application/domain/entities/plan'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import type { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import type {
  RawSubscriptionItem,
  RawSubscriptionItemReader,
} from '@/modules/thinkzap/domain/ports/raw-subscription-item-reader.port'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { ListOfferablePlans } from './list-offerable-plans'
import { ProviderResourceBilling } from './provider-resource-billing'
import { ProvisionLineFromSpaItem } from './provision-line-from-spa-item'

/**
 * Espelho do recurso: dublê que aceita tudo. O que ele grava é afirmado nos testes de
 * `saveResourceMirror` e do repositório Redis; aqui ele existe para o fluxo não depender
 * de Redis.
 */
const MIRRORS_DOUBLE = {
  find: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve()),
  setUnsubscribed: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
}

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

const NOW = new Date('2026-08-11T12:00:00.000Z')
const plusDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)

const product = {
  id: '42',
  name: 'ThinkZap',
  billingModel: 'subscription',
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

const TRIAL_PLAN: Plan = {
  id: '1',
  name: 'Teste',
  product,
  amount: 0,
  interval: 'monthly',
  active: true,
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

/** A linha que já existia antes do item criado à mão. */
const existingLine: SubscriptionItem = {
  id: '70',
  name: 'WhatsApp',
  subscription: '99',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
}

/** O item criado à mão, **depois** de o job gravar a credencial nele. */
const manualLine: SubscriptionItem = {
  ...existingLine,
  id: '77',
  name: 'Linha do comercial',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-2',
    zApiInstanceToken: 'tok-2',
  },
}

const paidSubscription = (
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
  items: [existingLine, manualLine],
  ...overrides,
})

const RAW_ZAPI_UNPROVISIONED: RawSubscriptionItem = {
  id: '77',
  provider: 'ZAPI',
  credentials: {},
  subscriptionId: '99',
  /** O provisionamento não olha o status: item nasce ativo, e cancelado não provisiona. */
  status: 'active',
}

type Options = {
  raw?: RawSubscriptionItem | null
  /** As assinaturas que `GetAplicationContext` devolve. */
  subscriptions?: SubscriptionWithItems[]
  /** A assinatura pai lida por `getSubscription`. */
  parent?: SubscriptionWithItems
  catalog?: Plan[]
  failProvision?: boolean
  failUpdateItem?: boolean
  failSync?: boolean
  provisionWithoutCredential?: boolean
  failSubscribe?: boolean
}

const makeUseCase = (options: Options = {}) => {
  const subscriptions = options.subscriptions ?? [paidSubscription()]
  const parent = options.parent ?? subscriptions[0]!

  const getRawSubscriptionItem = vi.fn(() =>
    Promise.resolve(
      options.raw === undefined ? RAW_ZAPI_UNPROVISIONED : options.raw,
    ),
  )
  const rawItems = { getRawSubscriptionItem } as RawSubscriptionItemReader

  const getSubscription = vi.fn(() => Promise.resolve(parent))
  const subscriptionRepo = {
    getSubscription,
    getSubscriptions: vi.fn(),
    getSubscriptionsByAplication: vi.fn(),
    listSubscriptionsByGatewayId: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
  } as unknown as SubscriptionRepository

  const updateSubscriptionItem = vi.fn(() =>
    options.failUpdateItem
      ? Promise.reject(new Error('crm.item.update falhou'))
      : Promise.resolve(manualLine),
  )
  const items = {
    getSubscriptionItem: vi.fn(),
    getSubscriptionItems: vi.fn(),
    getSubscriptionItemsBySubscription: vi.fn(),
    createSubscriptionItem: vi.fn(),
    updateSubscriptionItem,
    reparentSubscriptionItem: vi.fn(),
  } as unknown as SubscriptionItemRepository

  const context: AplicationContext = {
    customer: aplication.customer as never,
    aplication,
    subscriptions,
  }
  const contextExecute = vi.fn(() => Promise.resolve(context))
  const getAplicationContext = {
    execute: contextExecute,
  } as unknown as GetAplicationContext

  const getPlans = vi.fn(() =>
    Promise.resolve(options.catalog ?? [ZAPI_PLAN, HUB_PLAN, TRIAL_PLAN]),
  )
  const plans = new ListOfferablePlans({
    getPlan: vi.fn(),
    getPlans,
  } as unknown as PlanRepository)

  const syncSubscriptionLineItems = vi.fn(() =>
    options.failSync
      ? Promise.reject(new Error('gateway fora'))
      : Promise.resolve(),
  )
  const gateway = {
    verifyWebhookEvent: vi.fn(),
    createCheckoutSession: vi.fn(),
    syncSubscriptionLineItems,
    createBillingPortalSession: vi.fn(),
  } as unknown as PaymentGateway

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
          },
    )
  })
  const subscribe = vi.fn(() =>
    options.failSubscribe
      ? Promise.reject(new Error('provider fora'))
      : Promise.resolve(),
  )
  const resolve = vi.fn(() => ({
    provisionConnector,
    subscribe,
    unsubscribe: vi.fn(),
  }))
  const providerResolver = { resolve } as unknown as ConnectorProviderResolver

  /**
   * O `ProviderResourceBilling` **real**, não um dublê: a garantia que importa aqui é
   * "falhar ao assinar não derruba o job", e ela vive dentro dele. Com um dublê, o teste
   * afirmaria só que o método foi chamado.
   */
  const providerBilling = new ProviderResourceBilling(providerResolver)

  const useCase = new ProvisionLineFromSpaItem(
    rawItems,
    subscriptionRepo,
    items,
    getAplicationContext,
    plans,
    gateway,
    providerResolver,
    providerBilling,
    MIRRORS_DOUBLE,
  )

  return {
    useCase,
    getRawSubscriptionItem,
    getSubscription,
    updateSubscriptionItem,
    contextExecute,
    syncSubscriptionLineItems,
    provisionConnector,
    resolve,
    subscribe,
  }
}

const INPUT = { itemId: '77', traceKey: 'trace-1' }

describe('ProvisionLineFromSpaItem', () => {
  beforeEach(() => {
    vi.mocked(apiLogger.error).mockClear()
    vi.mocked(apiLogger.warn).mockClear()
    vi.mocked(apiLogger.info).mockClear()
    vi.mocked(apiLogger.debug).mockClear()
  })

  it('provisiona Z-API e grava só o bloco de metadata', async () => {
    const { useCase, resolve, updateSubscriptionItem } = makeUseCase()

    const result = await useCase.execute(INPUT)

    expect(resolve).toHaveBeenCalledWith(ConnectorProvider.ZAPI)
    /**
     * Igualdade exata, não subconjunto: é o que prova que `title`, `settings` e
     * `vinculatedChannel` não são tocados. O operador digitou o título, e
     * sobrescrevê-lo apagaria a identificação que ele deu à linha.
     */
    expect(updateSubscriptionItem).toHaveBeenCalledWith('77', {
      metadata: {
        provider: 'ZAPI',
        zApiInstanceId: 'inst-2',
        zApiInstanceToken: 'tok-2',
      },
    })
    expect(result).toEqual({ outcome: 'provisioned', billingAdjusted: true })
  })

  it('provisiona HubMessage e grava só o canal, sem WABA', async () => {
    const { useCase, resolve, updateSubscriptionItem } = makeUseCase({
      raw: { ...RAW_ZAPI_UNPROVISIONED, provider: 'HUBMESSAGE' },
    })

    await useCase.execute(INPUT)

    expect(resolve).toHaveBeenCalledWith(ConnectorProvider.HUBMESSAGE)
    expect(updateSubscriptionItem).toHaveBeenCalledWith('77', {
      metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'chan-2' },
    })
  })

  it('credencial já presente não chama o provider e segue para a cobrança', async () => {
    const {
      useCase,
      provisionConnector,
      updateSubscriptionItem,
      syncSubscriptionLineItems,
    } = makeUseCase({
      raw: {
        ...RAW_ZAPI_UNPROVISIONED,
        credentials: { zApiInstanceId: 'inst-2', zApiInstanceToken: 'tok-2' },
      },
    })

    const result = await useCase.execute(INPUT)

    expect(provisionConnector).not.toHaveBeenCalled()
    expect(updateSubscriptionItem).not.toHaveBeenCalled()
    expect(syncSubscriptionLineItems).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      outcome: 'already-provisioned',
      billingAdjusted: true,
    })
  })

  it('item NONE não provisiona nem cobra — a contagem de linhas não muda com ele', async () => {
    const {
      useCase,
      provisionConnector,
      syncSubscriptionLineItems,
      getSubscription,
    } = makeUseCase({
      raw: { ...RAW_ZAPI_UNPROVISIONED, provider: 'NONE' },
    })

    const result = await useCase.execute(INPUT)

    expect(provisionConnector).not.toHaveBeenCalled()
    expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
    expect(getSubscription).not.toHaveBeenCalled()
    expect(apiLogger.debug).toHaveBeenCalled()
    expect(result).toEqual({ outcome: 'no-connector', billingAdjusted: false })
  })

  describe('recusas: nenhum efeito no provider, nenhum no gateway, error nomeado', () => {
    const refusals: Array<[string, RawSubscriptionItem]> = [
      ['provider vazio', { ...RAW_ZAPI_UNPROVISIONED, provider: '' }],
      [
        'provider desconhecido',
        { ...RAW_ZAPI_UNPROVISIONED, provider: 'TWILIO' },
      ],
      [
        'par Z-API incompleto',
        {
          ...RAW_ZAPI_UNPROVISIONED,
          credentials: { zApiInstanceId: 'inst-2' },
        },
      ],
      [
        'WABA sem canal',
        {
          ...RAW_ZAPI_UNPROVISIONED,
          provider: 'HUBMESSAGE',
          credentials: { wabaId: 'waba-1' },
        },
      ],
      [
        'credencial cruzada',
        {
          ...RAW_ZAPI_UNPROVISIONED,
          provider: 'HUBMESSAGE',
          credentials: { zApiInstanceId: 'i', zApiInstanceToken: 't' },
        },
      ],
      [
        'NONE com credencial',
        {
          ...RAW_ZAPI_UNPROVISIONED,
          provider: 'NONE',
          credentials: { hubmessageChannelId: 'chan-1' },
        },
      ],
    ]

    for (const [name, raw] of refusals) {
      it(name, async () => {
        const {
          useCase,
          provisionConnector,
          syncSubscriptionLineItems,
          updateSubscriptionItem,
        } = makeUseCase({ raw })

        const result = await useCase.execute(INPUT)

        expect(provisionConnector).not.toHaveBeenCalled()
        expect(updateSubscriptionItem).not.toHaveBeenCalled()
        expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
        expect(apiLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            errorCode: 'thinkzap.subscription.manual_line_not_provisioned',
          }),
          expect.any(String),
        )
        expect(result).toEqual({ outcome: 'refused', billingAdjusted: false })
      })
    }

    it('item sem assinatura pai', async () => {
      const { useCase, provisionConnector } = makeUseCase({
        raw: { ...RAW_ZAPI_UNPROVISIONED, subscriptionId: null },
      })

      const result = await useCase.execute(INPUT)

      expect(provisionConnector).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'missing-parent' }),
        expect.any(String),
      )
      expect(result).toEqual({ outcome: 'refused', billingAdjusted: false })
    })
  })

  it('item apagado entre o evento e o job encerra em warn, não error', async () => {
    const { useCase, provisionConnector } = makeUseCase({ raw: null })

    const result = await useCase.execute(INPUT)

    expect(provisionConnector).not.toHaveBeenCalled()
    expect(apiLogger.warn).toHaveBeenCalled()
    expect(apiLogger.error).not.toHaveBeenCalled()
    expect(result).toEqual({ outcome: 'missing-item', billingAdjusted: false })
  })

  describe('cobrança', () => {
    it('contrato stripe vivo recebe a quantidade recontada', async () => {
      const { useCase, syncSubscriptionLineItems, contextExecute } =
        makeUseCase()

      await useCase.execute(INPUT)

      // O contexto é buscado pelo `domainId`/`appCode` da aplicação hidratada no pai.
      expect(contextExecute).toHaveBeenCalledWith({
        domainId: 'domain-1',
        appCode: 'crmthink.thinkzap',
      })
      // Duas linhas Z-API ativas: a que existia e a criada à mão.
      expect(syncSubscriptionLineItems).toHaveBeenCalledWith({
        gatewaySubscriptionId: 'sub_1',
        lineItems: [{ priceId: 'price_zapi', quantity: 2 }],
      })
    })

    it('soma as linhas das assinaturas irmãs do mesmo gatewayId', async () => {
      const hubLine: SubscriptionItem = {
        ...existingLine,
        id: '80',
        subscription: '100',
        metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'chan-9' },
      }
      const sibling = paidSubscription({
        id: '100',
        plan: HUB_PLAN,
        items: [hubLine],
      })

      const { useCase, syncSubscriptionLineItems } = makeUseCase({
        subscriptions: [paidSubscription(), sibling],
      })

      await useCase.execute(INPUT)

      expect(syncSubscriptionLineItems).toHaveBeenCalledWith({
        gatewaySubscriptionId: 'sub_1',
        // Um `line_item` por plano, na ordem em que os conectores aparecem no
        // contrato: o pai (Z-API) e depois a irmã (HubMessage).
        lineItems: [
          { priceId: 'price_zapi', quantity: 2 },
          { priceId: 'price_hub', quantity: 1 },
        ],
      })
    })

    it('ignora assinatura de outro contrato na contagem', async () => {
      const otherContract = paidSubscription({
        id: '200',
        gatewayId: 'sub_OUTRO',
        items: [{ ...existingLine, id: '90', subscription: '200' }],
      })

      const { useCase, syncSubscriptionLineItems } = makeUseCase({
        subscriptions: [paidSubscription(), otherContract],
      })

      await useCase.execute(INPUT)

      // Três linhas Z-API existem na instalação; só duas são deste contrato.
      expect(syncSubscriptionLineItems).toHaveBeenCalledWith({
        gatewaySubscriptionId: 'sub_1',
        lineItems: [{ priceId: 'price_zapi', quantity: 2 }],
      })
    })

    it('cobra o contrato do pai, mesmo quando o pai não é a assinatura vigente', async () => {
      const current = paidSubscription({
        id: '300',
        gatewayId: 'sub_VIGENTE',
        currentPeriodEnd: plusDays(60),
        items: [{ ...existingLine, id: '95', subscription: '300' }],
      })
      const parent = paidSubscription()

      const { useCase, syncSubscriptionLineItems } = makeUseCase({
        // A vigente vem primeiro na listagem, como `resolveCurrentContract` escolheria.
        subscriptions: [current, parent],
        parent,
      })

      await useCase.execute(INPUT)

      expect(syncSubscriptionLineItems).toHaveBeenCalledWith({
        gatewaySubscriptionId: 'sub_1',
        lineItems: [{ priceId: 'price_zapi', quantity: 2 }],
      })
    })

    it('modalidade manual provisiona e não toca o gateway', async () => {
      const parent = paidSubscription({ modality: 'manual' })
      const { useCase, syncSubscriptionLineItems, updateSubscriptionItem } =
        makeUseCase({ subscriptions: [parent], parent })

      const result = await useCase.execute(INPUT)

      expect(updateSubscriptionItem).toHaveBeenCalled()
      expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(apiLogger.info).toHaveBeenCalled()
      expect(result).toEqual({ outcome: 'provisioned', billingAdjusted: false })
    })

    it('trial provisiona, não cobra e não assina no provider', async () => {
      const parent = paidSubscription({
        status: 'trialing',
        plan: TRIAL_PLAN,
        gatewayId: undefined,
      })
      const {
        useCase,
        syncSubscriptionLineItems,
        subscribe,
        updateSubscriptionItem,
      } = makeUseCase({ subscriptions: [parent], parent })

      const result = await useCase.execute(INPUT)

      expect(updateSubscriptionItem).toHaveBeenCalled()
      expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(subscribe).not.toHaveBeenCalled()
      expect(result).toEqual({ outcome: 'provisioned', billingAdjusted: false })
    })

    it('contrato cancelado provisiona e registra warn sem tocar o gateway', async () => {
      const parent = paidSubscription({ status: 'cancelled' })
      const { useCase, syncSubscriptionLineItems, updateSubscriptionItem } =
        makeUseCase({ subscriptions: [parent], parent })

      const result = await useCase.execute(INPUT)

      expect(updateSubscriptionItem).toHaveBeenCalled()
      expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(apiLogger.warn).toHaveBeenCalled()
      expect(result).toEqual({ outcome: 'provisioned', billingAdjusted: false })
    })

    it('past_due cobra: a assinatura existe no gateway', async () => {
      const parent = paidSubscription({ status: 'past_due' })
      const { useCase, syncSubscriptionLineItems } = makeUseCase({
        subscriptions: [parent],
        parent,
      })

      await useCase.execute(INPUT)

      expect(syncSubscriptionLineItems).toHaveBeenCalledTimes(1)
    })

    it('plano ambíguo para um conector do contrato recusa a cobrança sem propagar', async () => {
      const { useCase, syncSubscriptionLineItems, updateSubscriptionItem } =
        makeUseCase({
          catalog: [ZAPI_PLAN, { ...ZAPI_PLAN, id: '9', gatewayId: 'price_x' }],
        })

      const result = await useCase.execute(INPUT)

      expect(updateSubscriptionItem).toHaveBeenCalled()
      expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'thinkzap.subscription.manual_line_billing_not_adjusted',
          reason: 'plan-for-provider-ambiguous',
        }),
        expect.any(String),
      )
      expect(result).toEqual({ outcome: 'provisioned', billingAdjusted: false })
    })

    it('conector sem plano no catálogo recusa a cobrança sem propagar', async () => {
      const { useCase, syncSubscriptionLineItems } = makeUseCase({
        catalog: [HUB_PLAN],
      })

      const result = await useCase.execute(INPUT)

      expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'plan-for-provider-missing' }),
        expect.any(String),
      )
      expect(result.billingAdjusted).toBe(false)
    })

    it('falha do gateway registra error e propaga para o retry da fila', async () => {
      const { useCase, updateSubscriptionItem } = makeUseCase({
        failSync: true,
      })

      await expect(useCase.execute(INPUT)).rejects.toThrow('gateway fora')

      // A credencial já está gravada: repetir não cria recurso novo.
      expect(updateSubscriptionItem).toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'thinkzap.subscription.manual_line_billing_not_adjusted',
          reason: 'sync-failed',
        }),
        expect.any(String),
      )
    })
  })

  describe('falhas de provisionamento', () => {
    it('provider fora propaga para o retry — nada foi criado lá', async () => {
      const { useCase, updateSubscriptionItem, syncSubscriptionLineItems } =
        makeUseCase({ failProvision: true })

      await expect(useCase.execute(INPUT)).rejects.toThrow('provider fora')

      expect(updateSubscriptionItem).not.toHaveBeenCalled()
      expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'provision-failed' }),
        expect.any(String),
      )
    })

    it('escrita da credencial falhando registra o recurso órfão e encerra', async () => {
      const { useCase, syncSubscriptionLineItems, subscribe } = makeUseCase({
        failUpdateItem: true,
      })

      const result = await useCase.execute(INPUT)

      expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(subscribe).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'thinkzap.subscription.manual_line_credential_orphaned',
          orphanRemoteId: 'inst-2',
        }),
        expect.any(String),
      )
      expect(result).toEqual({ outcome: 'orphaned', billingAdjusted: false })
    })

    it('provisionamento sem credencial cai no mesmo caminho do órfão', async () => {
      const { useCase, syncSubscriptionLineItems } = makeUseCase({
        provisionWithoutCredential: true,
      })

      const result = await useCase.execute(INPUT)

      expect(syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'thinkzap.subscription.manual_line_credential_orphaned',
        }),
        expect.any(String),
      )
      expect(result).toEqual({ outcome: 'orphaned', billingAdjusted: false })
    })
  })

  it('assina o recurso no provider com a referência da linha nova', async () => {
    const { useCase, subscribe } = makeUseCase()

    await useCase.execute(INPUT)

    // A credencial vem do item relido do contrato, não do retorno do provisionamento.
    expect(subscribe).toHaveBeenCalledWith({
      instanceId: 'inst-2',
      zApiToken: 'tok-2',
    })
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('falha no subscribe não derruba o job', async () => {
    const { useCase, subscribe } = makeUseCase({ failSubscribe: true })

    const result = await useCase.execute(INPUT)

    expect(subscribe).toHaveBeenCalled()
    expect(result).toEqual({ outcome: 'provisioned', billingAdjusted: true })
    expect(apiLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'thinkzap.subscription.provider_billing_failed',
      }),
      expect.any(String),
    )
  })
})
