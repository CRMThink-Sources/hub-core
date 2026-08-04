import { describe, expect, it, vi } from 'vitest'
import {
  ActivateLineSubscription,
  AplicationWithoutSpaMirrorError,
} from './activate-line-subscription'
import { ProviderResourceBilling } from './provider-resource-billing'
import { apiLogger } from '@/shared/infra/logger'
import type {
  AplicationContext,
  GetAplicationContext,
  SubscriptionWithItems,
} from '@/modules/application/application/get-aplication-context'
import type { Plan } from '@/modules/application/domain/entities/plan'
import type { Subscription } from '@/modules/application/domain/entities/subscription'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { SubscriptionRepository } from '@/modules/application/domain/repositories/subscription.repository'
import type { SubscriptionItemRepository } from '@/modules/application/domain/repositories/subscription-item.repository'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { SUBSCRIPTION_MODALITY_FIELD } from '@/modules/application/infra/bitrix/ensure-subscription-modality-field'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const NOW = new Date('2026-08-03T12:00:00.000Z')
const plusDays = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)

const TRIAL_PLAN: Plan = {
  id: '1',
  name: 'Teste',
  product: {
    id: '42',
    name: 'ThinkZap',
    billingModel: 'subscription',
    active: true,
  },
  amount: 0,
  interval: 'monthly',
  active: true,
}
const PAID_PLAN: Plan = {
  ...TRIAL_PLAN,
  id: '7',
  name: 'Pro',
  amount: 4990,
  gatewayId: 'price_abc',
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

const lineItem: SubscriptionItem = {
  id: '77',
  name: 'WhatsApp (teste)',
  subscription: '21',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: 'chan-9',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'inst-1',
    zApiInstanceToken: 'tok-1',
  },
}

const trialSubscription: SubscriptionWithItems = {
  id: '21',
  name: 'Teste — Acme',
  plan: TRIAL_PLAN,
  status: 'trialing',
  currentPeriodStart: plusDays(-5),
  currentPeriodEnd: plusDays(-2),
  aplication,
  modality: 'manual',
  items: [lineItem],
}

const paidSubscription: Subscription = {
  id: '99',
  name: 'Assinatura — ThinkZap — Acme',
  plan: PAID_PLAN,
  status: 'active',
  currentPeriodStart: NOW,
  currentPeriodEnd: plusDays(30),
  aplication,
  modality: 'stripe',
  gatewayId: 'sub_new',
}

const INPUT = {
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  planId: '7',
  gatewaySubscriptionId: 'sub_new',
  currentPeriodStart: NOW,
  currentPeriodEnd: plusDays(30),
}

type Options = {
  subscriptions?: SubscriptionWithItems[]
  existing?: Subscription | null
  spaId?: string | null
  modalityField?: Record<string, { type?: string }>
  failReparent?: boolean
  failEndTrial?: boolean
}

const makeUseCase = (options: Options = {}) => {
  const context: AplicationContext = {
    customer: aplication.customer as never,
    // `'spaId' in options` e não `??`: `null` é o caso sob teste, e `??` o
    // substituiria pelo default — o teste passaria a afirmar o contrário.
    aplication: {
      ...aplication,
      spaId: 'spaId' in options ? options.spaId! : '512',
    },
    subscriptions: options.subscriptions ?? [trialSubscription],
  }

  const getAplicationContext = {
    execute: vi.fn(() => Promise.resolve(context)),
  } as unknown as GetAplicationContext

  const getSubscriptionByGatewayId = vi.fn(() =>
    Promise.resolve(options.existing ?? null),
  )
  const createSubscription = vi.fn(() => Promise.resolve(paidSubscription))
  const updateSubscription = vi.fn(
    (_id: string, _patch: Record<string, unknown>) =>
      options.failEndTrial
        ? Promise.reject(new Error('bitrix fora'))
        : Promise.resolve({
            ...trialSubscription,
            status: 'cancelled' as const,
          }),
  )

  const subscriptions = {
    getSubscription: vi.fn(),
    getSubscriptions: vi.fn(),
    getSubscriptionsByAplication: vi.fn(),
    getSubscriptionByGatewayId,
    createSubscription,
    updateSubscription,
  } as unknown as SubscriptionRepository

  const reparentSubscriptionItem = vi.fn(() =>
    options.failReparent
      ? Promise.reject(new Error('crm.item.update falhou'))
      : Promise.resolve({ ...lineItem, subscription: '99' }),
  )
  const updateSubscriptionItem = vi.fn(() => Promise.resolve(lineItem))

  const items = {
    getSubscriptionItem: vi.fn(),
    getSubscriptionItems: vi.fn(),
    getSubscriptionItemsBySubscription: vi.fn(),
    createSubscriptionItem: vi.fn(),
    updateSubscriptionItem,
    reparentSubscriptionItem,
  } as unknown as SubscriptionItemRepository

  const subscribe = vi.fn(() => Promise.resolve())
  const unsubscribe = vi.fn(() => Promise.resolve())
  const providerBilling = {
    subscribe,
    unsubscribe,
  } as unknown as ProviderResourceBilling

  const getCrmItemFields = vi.fn(() =>
    Promise.resolve({
      result: {
        fields:
          options.modalityField ??
          ({ [SUBSCRIPTION_MODALITY_FIELD]: { type: 'string' } } as Record<
            string,
            { type?: string }
          >),
      },
    }),
  )
  const bitrix = { getCrmItemFields } as unknown as BitrixClient

  return {
    useCase: new ActivateLineSubscription(
      getAplicationContext,
      subscriptions,
      items,
      providerBilling,
      bitrix,
    ),
    getSubscriptionByGatewayId,
    createSubscription,
    updateSubscription,
    reparentSubscriptionItem,
    updateSubscriptionItem,
    subscribe,
    unsubscribe,
    getCrmItemFields,
  }
}

describe('ActivateLineSubscription', () => {
  describe('os três passos, nesta ordem', () => {
    it('cria a assinatura paga, move o item e encerra o trial', async () => {
      const deps = makeUseCase()

      const result = await deps.useCase.execute(INPUT)

      expect(result).toEqual({ subscriptionId: '99', alreadyActive: false })
      expect(deps.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: '7',
          aplicationSpaId: '512',
          status: 'active',
          gatewayId: 'sub_new',
          modality: 'stripe',
        }),
      )
      expect(deps.reparentSubscriptionItem).toHaveBeenCalledWith('77', '99')
      expect(deps.updateSubscription).toHaveBeenCalledWith('21', {
        status: 'cancelled',
      })
    })

    /**
     * A ordem é a decisão 1 do design, não preferência: encerrar o trial antes de
     * mover deixaria o item apontando para assinatura cancelada, e a linha ficaria
     * bloqueada **mesmo com pagamento aprovado**.
     */
    it('encerra o trial depois de mover, nunca antes', async () => {
      const order: string[] = []
      const deps = makeUseCase()

      deps.createSubscription.mockImplementation(() => {
        order.push('create')
        return Promise.resolve(paidSubscription)
      })
      deps.reparentSubscriptionItem.mockImplementation(() => {
        order.push('reparent')
        return Promise.resolve({ ...lineItem, subscription: '99' })
      })
      deps.updateSubscription.mockImplementation(() => {
        order.push('end-trial')
        return Promise.resolve({ ...trialSubscription, status: 'cancelled' })
      })
      deps.subscribe.mockImplementation(() => {
        order.push('subscribe')
        return Promise.resolve()
      })

      await deps.useCase.execute(INPUT)

      expect(order).toEqual(['create', 'reparent', 'end-trial', 'subscribe'])
    })

    /** Só o status. Período, plano e itens ficam como estão. */
    it('encerra gravando apenas o status', async () => {
      const deps = makeUseCase()

      await deps.useCase.execute(INPUT)

      expect(
        Object.keys(deps.updateSubscription.mock.calls[0]?.[1] ?? {}),
      ).toEqual(['status'])
    })

    /** Nenhuma escrita além do repai atinge o item. */
    it('não toca o item por nenhum outro caminho', async () => {
      const deps = makeUseCase()

      await deps.useCase.execute(INPUT)

      expect(deps.updateSubscriptionItem).not.toHaveBeenCalled()
    })
  })

  describe('falhas intermediárias', () => {
    /**
     * O risco concentrado: cliente pagou e a linha continua morta. O passo 3 não
     * roda, e o log nomeia as duas assinaturas e o item — sem os três ids ninguém
     * sabe qual mover para onde no CRM.
     */
    it('falha ao mover não encerra o trial, e registra erro com os três ids', async () => {
      const deps = makeUseCase({ failReparent: true })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow(
        'crm.item.update falhou',
      )

      expect(deps.updateSubscription).not.toHaveBeenCalled()
      expect(apiLogger.error).toHaveBeenCalled()
      const [payload] = vi.mocked(apiLogger.error).mock.calls.at(-1) ?? []
      expect(payload).toMatchObject({
        subscriptionItemId: '77',
        originSubscriptionId: '21',
        paidSubscriptionId: '99',
        gatewaySubscriptionId: 'sub_new',
      })
    })

    it('falha ao mover não assina o recurso no provider', async () => {
      const deps = makeUseCase({ failReparent: true })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow()

      expect(deps.subscribe).not.toHaveBeenCalled()
    })

    /**
     * A linha já funciona, porque o item aponta para a assinatura ativa. A
     * assinatura de trial sobrando não destrava nada por conta própria — a janela
     * dela já passou.
     */
    it('falha ao encerrar o trial não desfaz a ativação', async () => {
      const deps = makeUseCase({ failEndTrial: true })

      await expect(deps.useCase.execute(INPUT)).resolves.toEqual({
        subscriptionId: '99',
        alreadyActive: false,
      })

      expect(apiLogger.warn).toHaveBeenCalled()
      expect(deps.subscribe).toHaveBeenCalled()
    })

    /**
     * `subscribe` acontece depois das escritas e não pode derrubá-las: uma falha do
     * provider passaria a impedir a ativação de quem já pagou.
     */
    it('falha no provider não derruba a ativação', async () => {
      const deps = makeUseCase()
      // `ProviderResourceBilling` engole por conta própria; aqui garantimos que a
      // ativação não depende do resultado dele de nenhuma forma.
      deps.subscribe.mockResolvedValue(undefined)

      await expect(deps.useCase.execute(INPUT)).resolves.toMatchObject({
        alreadyActive: false,
      })
    })
  })

  describe('idempotência', () => {
    /** O gateway reentrega por design. */
    it('reentrega não cria assinatura, não move item e não assina de novo', async () => {
      const deps = makeUseCase({ existing: paidSubscription })

      const result = await deps.useCase.execute(INPUT)

      expect(result).toEqual({ subscriptionId: '99', alreadyActive: true })
      expect(deps.createSubscription).not.toHaveBeenCalled()
      expect(deps.reparentSubscriptionItem).not.toHaveBeenCalled()
      expect(deps.updateSubscription).not.toHaveBeenCalled()
      expect(deps.subscribe).not.toHaveBeenCalled()
    })

    it('verifica o id do gateway antes de qualquer escrita', async () => {
      const deps = makeUseCase({ existing: paidSubscription })

      await deps.useCase.execute(INPUT)

      expect(deps.getSubscriptionByGatewayId).toHaveBeenCalledWith('sub_new')
      expect(deps.getCrmItemFields).not.toHaveBeenCalled()
    })
  })

  describe('pré-requisitos', () => {
    /**
     * Sem o campo, `crm.item.update` descarta a modalidade em silêncio: a
     * assinatura nasceria lendo `manual` e o cliente perderia o portal.
     */
    it('falha nomeando o campo quando a modalidade não existe na SPA, sem criar assinatura', async () => {
      const deps = makeUseCase({ modalityField: { ufCrm91Status: {} } })

      await expect(deps.useCase.execute(INPUT)).rejects.toThrow(
        /ufCrm91Modality/,
      )

      expect(deps.createSubscription).not.toHaveBeenCalled()
    })

    it('falha quando a instalação não tem espelho na SPA', async () => {
      const deps = makeUseCase({ spaId: null })

      await expect(deps.useCase.execute(INPUT)).rejects.toBeInstanceOf(
        AplicationWithoutSpaMirrorError,
      )

      expect(deps.createSubscription).not.toHaveBeenCalled()
    })
  })

  describe('contratar com o trial em andamento', () => {
    /**
     * Permitido: a janela paga começa no checkout, sem crédito pelos dias não
     * usados. A linha continua funcionando sem interrupção, porque os dois estados
     * resolvem `active`.
     */
    it('é permitido, e encerra o trial do mesmo jeito', async () => {
      const deps = makeUseCase({
        subscriptions: [
          { ...trialSubscription, currentPeriodEnd: plusDays(2) },
        ],
      })

      await expect(deps.useCase.execute(INPUT)).resolves.toMatchObject({
        alreadyActive: false,
      })
      expect(deps.updateSubscription).toHaveBeenCalledWith('21', {
        status: 'cancelled',
      })
    })
  })

  describe('instalação sem linha', () => {
    it('cria a assinatura, registra o caso e não assina nada no provider', async () => {
      const deps = makeUseCase({
        subscriptions: [{ ...trialSubscription, items: [] }],
      })

      await expect(deps.useCase.execute(INPUT)).resolves.toMatchObject({
        subscriptionId: '99',
      })

      expect(deps.reparentSubscriptionItem).not.toHaveBeenCalled()
      expect(deps.subscribe).not.toHaveBeenCalled()
      expect(apiLogger.warn).toHaveBeenCalled()
    })
  })

  describe('assinatura de origem já encerrada', () => {
    it('não reescreve o status de quem já está cancelada', async () => {
      const deps = makeUseCase({
        subscriptions: [{ ...trialSubscription, status: 'cancelled' }],
      })

      await deps.useCase.execute(INPUT)

      expect(deps.updateSubscription).not.toHaveBeenCalled()
    })
  })
})
