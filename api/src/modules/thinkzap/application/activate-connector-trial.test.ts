import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ActivateConnectorTrial,
  TrialContactWriteFailedError,
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

const { apiLogger } = vi.hoisted(() => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

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

vi.mock('@/shared/infra/logger', () => ({ apiLogger }))

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

const CONTACT = {
  name: 'Joana Silva',
  email: 'joana@acme.com',
  phone: '5511999998888',
  company: 'Acme LTDA',
}

function makeSut(options?: {
  subscriptions?: unknown[]
  spaId?: string | null
  resource?: unknown
  provisionRejects?: Error
  createSubscriptionRejects?: Error
  updateContactRejects?: Error
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

  const updateContact = options?.updateContactRejects
    ? vi.fn().mockRejectedValue(options.updateContactRejects)
    : vi.fn().mockResolvedValue(undefined)

  const sut = new ActivateConnectorTrial(
    { execute } as never,
    { getPlan } as never,
    { createSubscription } as never,
    { createSubscriptionItem } as never,
    { resolve: () => ({ provisionConnector, subscribe }) } as never,
    { updateContact } as never,
    MIRRORS_DOUBLE,
  )

  return {
    sut,
    execute,
    getPlan,
    createSubscription,
    createSubscriptionItem,
    provisionConnector,
    subscribe,
    updateContact,
    activate: (provider = ConnectorProvider.ZAPI) =>
      sut.execute(
        {
          domainId: 'domain-1',
          appCode: 'crmthink.thinkzap',
          provider,
          contact: CONTACT,
        },
        NOW,
      ),
  }
}

describe('ActivateConnectorTrial', () => {
  beforeEach(() => {
    trialPlanId.value = 'plan-1'
    vi.clearAllMocks()
  })

  it('cria assinatura trialing de 3 dias e uma linha Z-API', async () => {
    const sut = makeSut()

    const result = await sut.activate()

    expect(sut.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan-1',
        aplicationSpaId: '1060-1',
        status: 'trialing',
        /**
         * Dias de calendário no fuso do contrato, não `NOW + 72h`: início no começo
         * do dia da ativação, fim no último instante do terceiro dia. O cliente tem
         * o último dia inteiro, e o dia gravado bate com o que ele vê na tela.
         */
        currentPeriodStart: new Date('2026-08-03T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-08-06T23:59:59.999Z'),
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
      new Date('2026-08-06T23:59:59.999Z'),
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

  /**
   * **Era o teste que travava o bug.** O provisionamento HubMessage devolve o canal e
   * nada mais — a WABA só existe depois de o cliente conectar o número na Meta, e
   * chega em `POST /connector/connect-channel`. Exigi-la aqui fazia **todo** trial
   * oficial falhar antes de gravar o item.
   */
  it('cria a linha HubMessage com o canal, sem exigir a WABA', async () => {
    const sut = makeSut({
      resource: { instanceId: 'C-NEW', channelId: 'C-NEW' },
    })

    await sut.activate(ConnectorProvider.HUBMESSAGE)

    expect(sut.createSubscriptionItem).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'C-NEW' },
      }),
    )
  })

  /** Sem canal não há recurso: aí sim a linha nunca identificaria nada. */
  it('falha quando o provisionamento HubMessage não devolve canal', async () => {
    const sut = makeSut({
      resource: { instanceId: '', channelId: null },
    })

    await expect(sut.activate(ConnectorProvider.HUBMESSAGE)).rejects.toThrow(
      /id do canal/i,
    )
    expect(sut.createSubscriptionItem).not.toHaveBeenCalled()
  })

  describe('contato', () => {
    it('grava o contato no item de cliente da instalação', async () => {
      const sut = makeSut()

      await sut.activate()

      expect(sut.updateContact).toHaveBeenCalledWith('1060-1', CONTACT)
    })

    /**
     * Elegibilidade e plano antes para não encher o CRM de lead que não vai ativar
     * teste nenhum; contato antes do provider porque contato salvo é lead capturado,
     * e a tentativa que falha no provider é a que mais precisa de atendimento humano.
     */
    it('grava depois de elegibilidade e plano, e antes de provisionar', async () => {
      const order: string[] = []
      const sut = makeSut()

      sut.execute.mockImplementation(() => {
        order.push('contexto')
        return Promise.resolve({
          customer: { id: 'domain-1', name: 'acme' },
          aplication: { id: 'app-1', spaId: '1060-1', title: 'ThinkZap' },
          subscriptions: [],
        })
      })
      sut.getPlan.mockImplementation(() => {
        order.push('plano')
        return Promise.resolve({ id: 'plan-1', name: 'Teste' })
      })
      sut.updateContact.mockImplementation(() => {
        order.push('contato')
        return Promise.resolve()
      })
      sut.provisionConnector.mockImplementation(() => {
        order.push('provider')
        return Promise.resolve(ZAPI_RESOURCE)
      })
      sut.createSubscription.mockImplementation(() => {
        order.push('assinatura')
        return Promise.resolve({ id: 'sub-new' })
      })
      sut.createSubscriptionItem.mockImplementation(() => {
        order.push('item')
        return Promise.resolve({ id: 'item-new', name: 'WhatsApp (teste)' })
      })

      await sut.activate()

      expect(order).toEqual([
        'contexto',
        'plano',
        'contato',
        'provider',
        'assinatura',
        'item',
      ])
    })

    it('não grava contato de instalação inelegível', async () => {
      const sut = makeSut({ subscriptions: [{ status: 'active' }] })

      await expect(sut.activate()).rejects.toBeInstanceOf(TrialNotEligibleError)
      expect(sut.updateContact).not.toHaveBeenCalled()
    })

    it('não grava contato quando o plano de trial não está configurado', async () => {
      trialPlanId.value = ''
      const sut = makeSut()

      await expect(sut.activate()).rejects.toBeInstanceOf(
        TrialPlanNotConfiguredError,
      )
      expect(sut.updateContact).not.toHaveBeenCalled()
    })

    it('aborta sem provisionar quando a gravação do contato falha', async () => {
      const sut = makeSut({ updateContactRejects: new Error('Bitrix fora') })

      await expect(sut.activate()).rejects.toBeInstanceOf(
        TrialContactWriteFailedError,
      )
      expect(sut.provisionConnector).not.toHaveBeenCalled()
      expect(sut.createSubscription).not.toHaveBeenCalled()
    })

    it('registra o erro com o code do runbook', async () => {
      const sut = makeSut({ updateContactRejects: new Error('Bitrix fora') })

      await expect(sut.activate()).rejects.toBeInstanceOf(
        TrialContactWriteFailedError,
      )

      expect(apiLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'thinkzap.subscription.trial_contact_failed',
        }),
        expect.any(String),
      )
    })

    /** Dado pessoal do cliente não é diagnóstico — o log leva a instalação e o erro. */
    it('não emite o contato no log da falha', async () => {
      const sut = makeSut({ updateContactRejects: new Error('Bitrix fora') })

      await expect(sut.activate()).rejects.toBeInstanceOf(
        TrialContactWriteFailedError,
      )

      const emitted = JSON.stringify(apiLogger.error.mock.calls)

      for (const value of Object.values(CONTACT)) {
        expect(emitted).not.toContain(value)
      }
    })

    /** Contato salvo é lead capturado — é o ponto de gravar antes do provider. */
    it('mantém o contato gravado quando o provisionamento falha depois', async () => {
      const sut = makeSut({ provisionRejects: new Error('z-api fora') })

      await expect(sut.activate()).rejects.toThrow('z-api fora')
      expect(sut.updateContact).toHaveBeenCalledTimes(1)
      expect(sut.createSubscription).not.toHaveBeenCalled()
    })

    /**
     * Nenhuma assinatura foi criada, então a elegibilidade continua intacta e a
     * retentativa reescreve o mesmo contato: idempotente.
     */
    it('permite retentativa depois de falha na gravação', async () => {
      const sut = makeSut({ updateContactRejects: new Error('Bitrix fora') })

      await expect(sut.activate()).rejects.toBeInstanceOf(
        TrialContactWriteFailedError,
      )

      sut.updateContact.mockResolvedValue(undefined)
      await expect(sut.activate()).resolves.toMatchObject({
        subscriptionId: 'sub-new',
      })

      expect(sut.updateContact).toHaveBeenNthCalledWith(2, '1060-1', CONTACT)
    })
  })
})
