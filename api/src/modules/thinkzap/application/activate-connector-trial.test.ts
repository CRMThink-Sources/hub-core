import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ActivateConnectorTrial,
  TrialNotEligibleError,
} from './activate-connector-trial'
import {
  TrialPlanMissingError,
  TrialPlanNotConfiguredError,
} from './helpers/ensure-trial-plan'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { InstanceStatus } from '@/modules/thinkzap/domain/entities/instance'
import { PlanNotFoundError } from '@/modules/application/domain/errors/plan-not-found.error'
import { InvalidBitrixPlanError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-plan.error'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const { trialPlanId } = vi.hoisted(() => ({ trialPlanId: { value: 'plan-1' } }))

vi.mock('@/config/env', () => ({
  env: {
    payments: {
      spa: { planEntityType: 1138 },
      get trialPlanId() {
        return trialPlanId.value
      },
    },
  },
}))

const NOW = new Date('2026-08-03T12:00:00.000Z')

const ZAPI_RESOURCE = {
  instanceId: 'Z-NEW',
  status: InstanceStatus.CONNECTED,
  zApiToken: 'TOK-NEW',
}

const HUB_RESOURCE = {
  instanceId: 'C-NEW',
  status: InstanceStatus.CONNECTED,
  channelId: 'C-NEW',
  wabaId: 'W-NEW',
}

function makeSut(options?: {
  subscriptions?: unknown[]
  spaId?: string | null
  resource?: unknown
  provisionRejects?: Error
  createSubscriptionRejects?: Error
}) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme' },
    aplication: {
      id: 'app-1',
      spaId: options?.spaId === undefined ? '1060-1' : options.spaId,
      title: 'ThinkZap',
    },
    subscriptions: options?.subscriptions ?? [],
  })

  const getPlan = vi.fn().mockResolvedValue({ id: 'plan-1', name: 'Teste' })

  const createSubscription = options?.createSubscriptionRejects
    ? vi.fn().mockRejectedValue(options.createSubscriptionRejects)
    : vi.fn().mockResolvedValue({ id: 'sub-new' })

  const createSubscriptionItem = vi
    .fn()
    .mockResolvedValue({ id: 'item-new', name: 'WhatsApp (teste)' })

  const provisionConnector = options?.provisionRejects
    ? vi.fn().mockRejectedValue(options.provisionRejects)
    : vi.fn().mockResolvedValue(options?.resource ?? ZAPI_RESOURCE)

  const subscribe = vi.fn()

  const sut = new ActivateConnectorTrial(
    { execute } as never,
    { getPlan } as never,
    { createSubscription } as never,
    { createSubscriptionItem } as never,
    { resolve: () => ({ provisionConnector, subscribe }) } as never,
  )

  return {
    sut,
    execute,
    getPlan,
    createSubscription,
    createSubscriptionItem,
    provisionConnector,
    subscribe,
    activate: (provider = ConnectorProvider.ZAPI) =>
      sut.execute(
        { domainId: 'domain-1', appCode: 'crmthink.thinkzap', provider },
        NOW,
      ),
  }
}

describe('ActivateConnectorTrial', () => {
  beforeEach(() => {
    trialPlanId.value = 'plan-1'
  })

  it('cria assinatura trialing de 3 dias e uma linha Z-API', async () => {
    const sut = makeSut()

    const result = await sut.activate()

    expect(sut.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan-1',
        aplicationSpaId: '1060-1',
        status: 'trialing',
        currentPeriodStart: NOW,
        currentPeriodEnd: new Date('2026-08-06T12:00:00.000Z'),
      }),
    )
    expect(sut.createSubscriptionItem).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: 'sub-new',
        status: 'active',
        metadata: {
          provider: 'ZAPI',
          zApiInstanceId: 'Z-NEW',
          zApiInstanceToken: 'TOK-NEW',
        },
      }),
    )
    expect(result.currentPeriodEnd).toEqual(
      new Date('2026-08-06T12:00:00.000Z'),
    )
  })

  it('cria uma linha HubMessage quando o provider é oficial', async () => {
    const sut = makeSut({ resource: HUB_RESOURCE })

    await sut.activate(ConnectorProvider.HUBMESSAGE)

    expect(sut.createSubscriptionItem).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: 'C-NEW',
          wabaId: 'W-NEW',
        },
      }),
    )
  })

  /**
   * `subscribe` liga a cobrança do recurso no provider. Sem esta distinção, 3 dias de
   * teste viram uma instância cobrada por mês.
   */
  it('provisiona sem assinar o recurso no provider', async () => {
    const sut = makeSut()

    await sut.activate()

    expect(sut.provisionConnector).toHaveBeenCalledTimes(1)
    expect(sut.subscribe).not.toHaveBeenCalled()
  })

  it('cria exatamente uma linha', async () => {
    const sut = makeSut()

    await sut.activate()

    expect(sut.createSubscriptionItem).toHaveBeenCalledTimes(1)
  })

  /**
   * Ordem obrigatória: invertida, uma instalação inelegível deixaria recurso remoto
   * provisionado a cada tentativa.
   */
  it('recusa segunda ativação sem tocar o provider', async () => {
    const sut = makeSut({ subscriptions: [{ status: 'trialing' }] })

    await expect(sut.activate()).rejects.toBeInstanceOf(TrialNotEligibleError)
    expect(sut.provisionConnector).not.toHaveBeenCalled()
    expect(sut.createSubscription).not.toHaveBeenCalled()
  })

  it('recusa cliente pagante com razão de contrato', async () => {
    const sut = makeSut({ subscriptions: [{ status: 'active' }] })

    await expect(sut.activate()).rejects.toMatchObject({
      reason: 'has-contract',
    })
    expect(sut.provisionConnector).not.toHaveBeenCalled()
  })

  it('recusa instalação sem espelho na SPA', async () => {
    const sut = makeSut({ spaId: null })

    await expect(sut.activate()).rejects.toMatchObject({
      reason: 'no-spa-mirror',
    })
    expect(sut.provisionConnector).not.toHaveBeenCalled()
  })

  it('aborta antes de provisionar quando o plano não está configurado', async () => {
    trialPlanId.value = ''
    const sut = makeSut()

    await expect(sut.activate()).rejects.toBeInstanceOf(
      TrialPlanNotConfiguredError,
    )
    expect(sut.provisionConnector).not.toHaveBeenCalled()
  })

  it('aborta antes de provisionar quando o plano não existe na SPA', async () => {
    const sut = makeSut()
    sut.getPlan.mockRejectedValue(new PlanNotFoundError('3'))

    await expect(sut.activate()).rejects.toBeInstanceOf(TrialPlanMissingError)
    expect(sut.provisionConnector).not.toHaveBeenCalled()
  })

  /** Item existe mas sem valor ou intervalo: o mapper reprova, e é configuração. */
  it('aborta quando o plano existe mas tem shape inválido', async () => {
    const sut = makeSut()
    sut.getPlan.mockRejectedValue(new InvalidBitrixPlanError([]))

    await expect(sut.activate()).rejects.toBeInstanceOf(TrialPlanMissingError)
    expect(sut.provisionConnector).not.toHaveBeenCalled()
  })

  /**
   * Bitrix fora do ar **não** é "plano não configurado". Traduzir os dois igual faria
   * uma indisponibilidade passageira mandar o cliente abrir chamado no suporte.
   */
  it('propaga falha de leitura em vez de chamá-la de configuração', async () => {
    const sut = makeSut()
    sut.getPlan.mockRejectedValue(new Error('Bitrix indisponível'))

    await expect(sut.activate()).rejects.toThrow('Bitrix indisponível')
    expect(sut.provisionConnector).not.toHaveBeenCalled()
  })

  /** Recurso remoto criado e trial não: relança, e o log nomeia o órfão. */
  it('relança quando a assinatura falha depois de provisionar', async () => {
    const sut = makeSut({
      createSubscriptionRejects: new Error('Bitrix fora'),
    })

    await expect(sut.activate()).rejects.toThrow('Bitrix fora')
    expect(sut.provisionConnector).toHaveBeenCalledTimes(1)
  })

  it('falha quando o provisionamento Z-API não devolve token', async () => {
    const sut = makeSut({
      resource: { instanceId: 'Z-NEW', status: InstanceStatus.CONNECTED },
    })

    await expect(sut.activate()).rejects.toThrow(/token/i)
    expect(sut.createSubscriptionItem).not.toHaveBeenCalled()
  })

  it('falha quando o provisionamento HubMessage não devolve WABA', async () => {
    const sut = makeSut({
      resource: { instanceId: 'C-NEW', channelId: 'C-NEW' },
    })

    await expect(sut.activate(ConnectorProvider.HUBMESSAGE)).rejects.toThrow(
      /WABA/i,
    )
    expect(sut.createSubscriptionItem).not.toHaveBeenCalled()
  })
})
