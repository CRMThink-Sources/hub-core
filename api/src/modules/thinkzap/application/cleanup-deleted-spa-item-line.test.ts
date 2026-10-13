import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CleanupDeletedSpaItemLine } from './cleanup-deleted-spa-item-line'
import { ListOfferablePlans } from './list-offerable-plans'
import { ProviderResourceBilling } from './provider-resource-billing'
import type {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import type { Plan } from '@/modules/application/domain/entities/plan'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { PlanRepository } from '@/modules/application/domain/repositories/get-plan.repository'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import type {
  SpaItemResourceMirror,
  SpaItemResourceMirrorRepository,
} from '@/modules/application/domain/repositories/spa-item-resource-mirror.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { ConnectorProviderResolver } from '@/modules/thinkzap/domain/ports/connector-provider-resolver.port'
import type { PaymentGateway } from '@/modules/thinkzap/domain/ports/payment-gateway.port'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { apiLogger } from '@/shared/infra/logger'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const NOW = new Date('2026-08-13T12:00:00.000Z')
const INPUT = { itemId: '77', traceKey: 'spa-item-77' }

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

/** Segundo plano do catálogo, para o contrato de dois conectores. */
const HUB_PLAN = {
  ...ZAPI_PLAN,
  id: '8',
  gatewayId: 'price_hub',
  provider: 'HUBMESSAGE' as const,
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

/** A linha que **sobrou** depois de o item 77 ser apagado. */
const survivingLine: SubscriptionItem = {
  id: '70',
  name: 'WhatsApp',
  subscription: '42',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
}

const subscription = (
  overrides: Partial<SubscriptionWithItems> = {},
): SubscriptionWithItems => ({
  id: '42',
  name: 'Pro — ThinkZap — Acme',
  plan: ZAPI_PLAN,
  status: 'active',
  currentPeriodStart: NOW,
  currentPeriodEnd: NOW,
  aplication,
  modality: 'stripe',
  gatewayId: 'sub_1',
  items: [survivingLine],
  ...overrides,
})

const ZAPI_MIRROR: SpaItemResourceMirror = {
  provider: 'ZAPI',
  instanceId: 'inst-2',
  zApiToken: 'tok-2',
  subscriptionId: '42',
}

const HUB_MIRROR: SpaItemResourceMirror = {
  provider: 'HUBMESSAGE',
  instanceId: 'chan-2',
  channelId: 'chan-2',
  subscriptionId: '42',
}

type Options = {
  mirror?: SpaItemResourceMirror | null
  parent?: SubscriptionWithItems
  /** `true` faz `getSubscription` lançar: pai apagado junto. */
  failParent?: boolean
  failUnsubscribe?: boolean
  failDisconnect?: boolean
  failSync?: boolean
  /** `true` faz o encerramento do contrato falhar. */
  failCancel?: boolean
  gateway?: PaymentGateway | null
}

const makeUseCase = (options: Options = {}) => {
  const parent = options.parent ?? subscription()

  const stored =
    options.mirror === undefined ? { ...ZAPI_MIRROR } : options.mirror

  const find = vi.fn(() => Promise.resolve(stored))
  const remove = vi.fn(() => Promise.resolve())
  const mirrors = {
    find,
    save: vi.fn(() => Promise.resolve()),
    setBillingState: vi.fn(() => Promise.resolve()),
    remove,
  } as unknown as SpaItemResourceMirrorRepository

  const unsubscribe = vi.fn(() =>
    options.failUnsubscribe
      ? Promise.reject(new Error('provider fora'))
      : Promise.resolve(),
  )
  const disconnect = vi.fn(() =>
    options.failDisconnect
      ? Promise.reject(new Error('provider fora'))
      : Promise.resolve(),
  )
  const resolve = vi.fn(() => ({
    provisionConnector: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe,
    disconnect,
    getConnectionStatus: vi.fn(),
  }))
  const providerResolver = { resolve } as unknown as ConnectorProviderResolver

  /**
   * O `ProviderResourceBilling` **real**, não um dublê: a garantia que importa é
   * "propagar quando o chamador é job", e ela vive dentro dele.
   */
  const providerBilling = new ProviderResourceBilling(providerResolver)

  const getSubscription = vi.fn(() =>
    options.failParent
      ? Promise.reject(new Error('item não existe'))
      : Promise.resolve(parent),
  )
  const subscriptions = {
    getSubscription,
    getSubscriptions: vi.fn(),
    getSubscriptionsByAplication: vi.fn(),
    listSubscriptionsByGatewayId: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
  } as unknown as SubscriptionRepository

  const context: AplicationContext = {
    customer: aplication.customer as never,
    aplication,
    subscriptions: [parent],
  }
  const getAplicationContext = {
    execute: vi.fn(() => Promise.resolve(context)),
  } as unknown as GetAplicationContext

  const plans = new ListOfferablePlans({
    getPlan: vi.fn(),
    getPlans: vi.fn(() => Promise.resolve([ZAPI_PLAN, HUB_PLAN])),
  } as unknown as PlanRepository)

  const syncSubscriptionLineItems = vi.fn(() =>
    options.failSync
      ? Promise.reject(new Error('gateway fora'))
      : Promise.resolve(),
  )
  const cancelSubscriptionAtPeriodEnd = vi.fn(() =>
    options.failCancel
      ? Promise.reject(new Error('gateway fora'))
      : Promise.resolve(),
  )
  const gateway =
    options.gateway === null
      ? null
      : ({
          verifyWebhookEvent: vi.fn(),
          createCheckoutSession: vi.fn(),
          syncSubscriptionLineItems,
          cancelSubscriptionAtPeriodEnd,
          createBillingPortalSession: vi.fn(),
        } as unknown as PaymentGateway)

  return {
    useCase: new CleanupDeletedSpaItemLine(
      mirrors,
      providerBilling,
      providerResolver,
      subscriptions,
      getAplicationContext,
      plans,
      gateway,
    ),
    find,
    remove,
    unsubscribe,
    disconnect,
    resolve,
    getSubscription,
    syncSubscriptionLineItems,
    cancelSubscriptionAtPeriodEnd,
  }
}

describe('CleanupDeletedSpaItemLine', () => {
  beforeEach(() => vi.clearAllMocks())

  it('desassina, desconecta, ajusta cobrança e apaga o espelho', async () => {
    const sut = makeUseCase()

    const result = await sut.useCase.execute(INPUT)

    expect(result).toEqual({ outcome: 'cleaned', billingAdjusted: true })
    expect(sut.unsubscribe).toHaveBeenCalledWith(
      { instanceId: 'inst-2', zApiToken: 'tok-2' },
      expect.any(String),
    )
    expect(sut.disconnect).toHaveBeenCalledWith({
      instanceId: 'inst-2',
      zApiToken: 'tok-2',
    })
    expect(sut.remove).toHaveBeenCalledWith('77')
  })

  it('opera a linha HubMessage pelo canal', async () => {
    const sut = makeUseCase({ mirror: { ...HUB_MIRROR } })

    await sut.useCase.execute(INPUT)

    expect(sut.resolve).toHaveBeenCalledWith(ConnectorProvider.HUBMESSAGE)
    expect(sut.unsubscribe).toHaveBeenCalledWith(
      { instanceId: 'chan-2', channelId: 'chan-2' },
      expect.any(String),
    )
    expect(sut.disconnect).toHaveBeenCalledWith({
      instanceId: 'chan-2',
      channelId: 'chan-2',
    })
  })

  it('a quantidade cobrada passa a refletir só as linhas que sobraram', async () => {
    const sut = makeUseCase()

    await sut.useCase.execute(INPUT)

    expect(sut.syncSubscriptionLineItems).toHaveBeenCalledWith({
      gatewaySubscriptionId: 'sub_1',
      lineItems: [{ priceId: 'price_zapi', quantity: 1 }],
    })
  })

  it('não chama provider nenhum quando o espelho não existe', async () => {
    const sut = makeUseCase({ mirror: null })

    const result = await sut.useCase.execute(INPUT)

    expect(result).toEqual({
      outcome: 'missing-mirror',
      billingAdjusted: false,
    })
    expect(sut.resolve).not.toHaveBeenCalled()
    expect(sut.remove).not.toHaveBeenCalled()
    expect(apiLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: '77' }),
      expect.stringContaining('órfão'),
    )
  })

  it('pula a desassinatura quando o status do item já a fez', async () => {
    const sut = makeUseCase({
      mirror: { ...ZAPI_MIRROR, unsubscribedAt: '2026-08-01T00:00:00.000Z' },
    })

    const result = await sut.useCase.execute(INPUT)

    expect(result.outcome).toBe('cleaned')
    expect(sut.unsubscribe).not.toHaveBeenCalled()
    // Desconectar e ajustar cobrança continuam: só a cobrança do recurso já estava feita.
    expect(sut.disconnect).toHaveBeenCalled()
    expect(sut.syncSubscriptionLineItems).toHaveBeenCalled()
    expect(sut.remove).toHaveBeenCalledWith('77')
  })

  describe('guardas da cobrança', () => {
    it('modalidade fora do gateway não escreve no gateway', async () => {
      const sut = makeUseCase({
        parent: subscription({ modality: 'manual' }),
      })

      const result = await sut.useCase.execute(INPUT)

      expect(result).toEqual({ outcome: 'cleaned', billingAdjusted: false })
      expect(sut.syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(sut.unsubscribe).toHaveBeenCalled()
    })

    it('contrato em trial não tem line_item a ajustar', async () => {
      const sut = makeUseCase({
        parent: subscription({ status: 'trialing' }),
      })

      const result = await sut.useCase.execute(INPUT)

      expect(result.billingAdjusted).toBe(false)
      expect(sut.syncSubscriptionLineItems).not.toHaveBeenCalled()
    })

    it('assinatura sem gatewayId não tem contrato a ajustar', async () => {
      const sut = makeUseCase({
        parent: subscription({ gatewayId: undefined }),
      })

      const result = await sut.useCase.execute(INPUT)

      expect(result.billingAdjusted).toBe(false)
      expect(sut.syncSubscriptionLineItems).not.toHaveBeenCalled()
    })

    it('assinatura já cancelada registra warn e não ajusta', async () => {
      const sut = makeUseCase({
        parent: subscription({ status: 'cancelled' }),
      })

      const result = await sut.useCase.execute(INPUT)

      expect(result.billingAdjusted).toBe(false)
      expect(apiLogger.warn).toHaveBeenCalled()
      expect(sut.syncSubscriptionLineItems).not.toHaveBeenCalled()
    })

    it('gateway não configurado encerra com sucesso e pendência nomeada', async () => {
      const sut = makeUseCase({ gateway: null })

      const result = await sut.useCase.execute(INPUT)

      expect(result).toEqual({ outcome: 'cleaned', billingAdjusted: false })
      expect(apiLogger.error).toHaveBeenCalled()
      // O recurso já foi desassinado: retentar não configura ambiente.
      expect(sut.remove).toHaveBeenCalledWith('77')
    })

    it('assinatura pai ilegível encerra a limpeza sem ajustar cobrança', async () => {
      const sut = makeUseCase({ failParent: true })

      const result = await sut.useCase.execute(INPUT)

      expect(result).toEqual({ outcome: 'cleaned', billingAdjusted: false })
      expect(sut.unsubscribe).toHaveBeenCalled()
      expect(sut.syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(sut.remove).toHaveBeenCalledWith('77')
    })
  })

  describe('falha propaga e preserva o espelho', () => {
    it('falha ao desassinar', async () => {
      const sut = makeUseCase({ failUnsubscribe: true })

      await expect(sut.useCase.execute(INPUT)).rejects.toThrow('provider fora')

      expect(sut.disconnect).not.toHaveBeenCalled()
      expect(sut.remove).not.toHaveBeenCalled()
    })

    it('falha ao desconectar', async () => {
      const sut = makeUseCase({ failDisconnect: true })

      await expect(sut.useCase.execute(INPUT)).rejects.toThrow('provider fora')

      expect(sut.syncSubscriptionLineItems).not.toHaveBeenCalled()
      expect(sut.remove).not.toHaveBeenCalled()
    })

    /**
     * O espelho preservado é o que permite ao retry reencontrar a credencial. Repetir o
     * `unsubscribe` no retry seria inofensivo, e nem acontece — a marca não é gravada
     * aqui, mas o passo é idempotente no provider.
     */
    it('falha ao ajustar a cobrança', async () => {
      const sut = makeUseCase({ failSync: true })

      await expect(sut.useCase.execute(INPUT)).rejects.toThrow('gateway fora')

      expect(sut.remove).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalled()
    })
  })
})

/**
 * O buraco que a exclusão pela tela abriu: reconciliar quantidade não encerra
 * contrato, e lista vazia significa "nada a mudar" para `syncSubscriptionLineItems`.
 */
describe('CleanupDeletedSpaItemLine — última linha do contrato', () => {
  beforeEach(() => vi.clearAllMocks())

  it('encerra a assinatura no fim do período quando não sobrou linha', async () => {
    const sut = makeUseCase({ parent: subscription({ items: [] }) })

    const result = await sut.useCase.execute(INPUT)

    expect(sut.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith('sub_1')
    expect(result.billingAdjusted).toBe(true)
  })

  /** Encerrar e sincronizar são exclusivos: sincronizar lista vazia não faz nada. */
  it('não sincroniza line_items ao encerrar', async () => {
    const sut = makeUseCase({ parent: subscription({ items: [] }) })

    await sut.useCase.execute(INPUT)

    expect(sut.syncSubscriptionLineItems).not.toHaveBeenCalled()
  })

  it('sobrando linha, reduz a quantidade e não encerra', async () => {
    const sut = makeUseCase()

    await sut.useCase.execute(INPUT)

    expect(sut.syncSubscriptionLineItems).toHaveBeenCalled()
    expect(sut.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled()
  })

  it('falha ao encerrar propaga para a fila retentar', async () => {
    const sut = makeUseCase({
      parent: subscription({ items: [] }),
      failCancel: true,
    })

    await expect(sut.useCase.execute(INPUT)).rejects.toThrow('gateway fora')
  })

  /** As guardas de modalidade e trial vêm antes: nem chegam ao ramo de encerrar. */
  it('boleto não encerra contrato', async () => {
    const sut = makeUseCase({
      parent: subscription({ items: [], modality: 'manual' }),
    })

    const result = await sut.useCase.execute(INPUT)

    expect(sut.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled()
    expect(result.billingAdjusted).toBe(false)
  })

  it('trial não encerra contrato', async () => {
    const sut = makeUseCase({
      parent: subscription({ items: [], status: 'trialing' }),
    })

    const result = await sut.useCase.execute(INPUT)

    expect(sut.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled()
    expect(result.billingAdjusted).toBe(false)
  })

  it('contrato já cancelado não é encerrado de novo', async () => {
    const sut = makeUseCase({
      parent: subscription({ items: [], status: 'cancelled' }),
    })

    const result = await sut.useCase.execute(INPUT)

    expect(sut.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled()
    expect(result.billingAdjusted).toBe(false)
  })

  it('ambiente sem gateway não encerra e não falha o job', async () => {
    const sut = makeUseCase({
      parent: subscription({ items: [] }),
      gateway: null,
    })

    const result = await sut.useCase.execute(INPUT)

    expect(result.billingAdjusted).toBe(false)
  })
})

/**
 * Contrato de dois conectores onde a exclusão zera **um** deles. A lista derivada
 * ainda tem um `line_item`, então o caminho é a reconciliação normal — não encerrar.
 */
describe('CleanupDeletedSpaItemLine — contrato com dois planos', () => {
  beforeEach(() => vi.clearAllMocks())

  const oficialLine: SubscriptionItem = {
    id: '71',
    name: 'WhatsApp Oficial',
    subscription: '42',
    status: 'active',
    settings: { ...DEFAULT_CONNECTOR_SETTINGS },
    vinculatedChannel: null,
    metadata: {
      provider: 'HUBMESSAGE',
      hubmessageChannelId: 'chan-1',
      wabaId: 'waba-1',
    },
  }

  it('zerar um plano não encerra o contrato', async () => {
    const sut = makeUseCase({ parent: subscription({ items: [oficialLine] }) })

    await sut.useCase.execute(INPUT)

    expect(sut.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled()
  })

  it('o plano zerado sai dos line_items e o outro continua', async () => {
    const sut = makeUseCase({ parent: subscription({ items: [oficialLine] }) })

    await sut.useCase.execute(INPUT)

    expect(sut.syncSubscriptionLineItems).toHaveBeenCalledWith({
      gatewaySubscriptionId: 'sub_1',
      lineItems: [{ priceId: 'price_hub', quantity: 1 }],
    })
  })
})
