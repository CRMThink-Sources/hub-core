import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GetConnectorTrialState } from './get-connector-trial-state'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { PlanNotFoundError } from '@/modules/application/domain/errors/plan-not-found.error'
import { InvalidBitrixPlanError } from '@/modules/application/infra/bitrix/errors/invalid-bitrix-plan.error'

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

const zapiItem = { metadata: { provider: 'ZAPI' } }
const hubItem = { metadata: { provider: 'HUBMESSAGE' } }

/** Item recém-instalado: só o e-mail da instalação, o resto por preencher. */
const EMPTY_CONTACT = {
  name: '',
  email: 'admin@acme.com',
  phone: '',
  company: '',
}

const FILLED_CONTACT = {
  name: 'Joana Silva',
  email: 'joana@acme.com',
  phone: '5511999998888',
  company: 'Acme LTDA',
}

function makeSut(options?: {
  subscriptions?: unknown[]
  spaId?: string | null
  planRejects?: Error
  contact?: typeof EMPTY_CONTACT
}) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme' },
    aplication: {
      spaId: options?.spaId === undefined ? '1060-1' : options.spaId,
    },
    subscriptions: options?.subscriptions ?? [],
  })

  const getPlan = options?.planRejects
    ? vi.fn().mockRejectedValue(options.planRejects)
    : vi.fn().mockResolvedValue({ id: 'plan-1' })

  const getContact = vi
    .fn()
    .mockResolvedValue(options?.contact ?? EMPTY_CONTACT)

  const sut = new GetConnectorTrialState(
    { execute } as never,
    {
      getPlan,
    } as never,
    { getContact } as never,
  )

  return {
    getContact,
    state: () =>
      sut.execute({ domainId: 'domain-1', appCode: 'crmthink.thinkzap' }, NOW),
  }
}

describe('GetConnectorTrialState', () => {
  beforeEach(() => {
    trialPlanId.value = 'plan-1'
  })

  it('instalação nova pode ativar, com os dois providers e o contato conhecido', async () => {
    const sut = makeSut()

    await expect(sut.state()).resolves.toEqual({
      status: 'available',
      providers: [ConnectorProvider.ZAPI, ConnectorProvider.HUBMESSAGE],
      contact: EMPTY_CONTACT,
    })
  })

  it('traz o contato já preenchido para a tela confirmar', async () => {
    const sut = makeSut({ contact: FILLED_CONTACT })

    await expect(sut.state()).resolves.toMatchObject({
      contact: FILLED_CONTACT,
    })
  })

  it('lê o contato pelo id do item da instalação', async () => {
    const sut = makeSut()

    await sut.state()

    expect(sut.getContact).toHaveBeenCalledWith('1060-1')
  })

  /**
   * Estado próprio: sem ele a ativação falharia com erro de hidratação de plano, e a
   * tela mostraria "erro" para o que é configuração faltando.
   */
  it('elegível mas sem plano configurado reporta misconfigured', async () => {
    trialPlanId.value = ''
    const sut = makeSut()

    await expect(sut.state()).resolves.toEqual({ status: 'misconfigured' })
  })

  it('elegível mas com plano inexistente na SPA reporta misconfigured', async () => {
    const sut = makeSut({ planRejects: new PlanNotFoundError('3') })

    await expect(sut.state()).resolves.toEqual({ status: 'misconfigured' })
  })

  /**
   * O caso real do ambiente local: item "Trial ThinkZap" criado, mas com valor e
   * intervalo de cobrança vazios. O mapper reprova o item inteiro.
   */
  it('plano com shape inválido também reporta misconfigured', async () => {
    const sut = makeSut({ planRejects: new InvalidBitrixPlanError([]) })

    await expect(sut.state()).resolves.toEqual({ status: 'misconfigured' })
  })

  /**
   * Bitrix fora **não** é "não configurado": a tela tem que dizer "não foi possível
   * verificar", senão manda o cliente ao suporte por indisponibilidade passageira.
   */
  it('propaga falha de leitura em vez de reportar misconfigured', async () => {
    const sut = makeSut({ planRejects: new Error('Bitrix indisponível') })

    await expect(sut.state()).rejects.toThrow('Bitrix indisponível')
  })

  it('trial dentro da janela está ativo, com a data de fim crua', async () => {
    const end = new Date('2026-08-06T12:00:00.000Z')
    const sut = makeSut({
      subscriptions: [
        { status: 'trialing', currentPeriodEnd: end, items: [zapiItem] },
      ],
    })

    await expect(sut.state()).resolves.toEqual({
      status: 'active',
      provider: ConnectorProvider.ZAPI,
      currentPeriodEnd: end,
    })
  })

  it('trial fora da janela está expirado', async () => {
    const end = new Date('2026-07-01T12:00:00.000Z')
    const sut = makeSut({
      subscriptions: [
        { status: 'trialing', currentPeriodEnd: end, items: [hubItem] },
      ],
    })

    await expect(sut.state()).resolves.toEqual({
      status: 'expired',
      provider: ConnectorProvider.HUBMESSAGE,
      currentPeriodEnd: end,
    })
  })

  it('cliente pagante fica indisponível com razão de contrato', async () => {
    const sut = makeSut({ subscriptions: [{ status: 'active', items: [] }] })

    await expect(sut.state()).resolves.toEqual({
      status: 'unavailable',
      reason: 'has-contract',
    })
  })

  it('instalação sem espelho fica indisponível com a razão do espelho', async () => {
    const sut = makeSut({ spaId: null })

    await expect(sut.state()).resolves.toEqual({
      status: 'unavailable',
      reason: 'no-spa-mirror',
    })
  })

  /**
   * Contato só rende formulário no estado que permite ativar. Nos outros seria
   * superfície sem uso — e uma chamada ao CRM que a instalação já ativada, o caso
   * comum em regime, pagaria a cada leitura de tela.
   */
  describe('contato só existe no estado available', () => {
    const cases: Array<[string, Parameters<typeof makeSut>[0]]> = [
      [
        'trial ativo',
        {
          subscriptions: [
            {
              status: 'trialing',
              currentPeriodEnd: new Date('2026-08-06T12:00:00.000Z'),
              items: [zapiItem],
            },
          ],
        },
      ],
      [
        'trial expirado',
        {
          subscriptions: [
            {
              status: 'trialing',
              currentPeriodEnd: new Date('2026-07-01T12:00:00.000Z'),
              items: [hubItem],
            },
          ],
        },
      ],
      ['cliente pagante', { subscriptions: [{ status: 'active', items: [] }] }],
      ['sem espelho na SPA', { spaId: null }],
      ['plano não configurado', {}],
    ]

    it.each(cases)('%s não traz contato nem o lê', async (label, options) => {
      if (label === 'plano não configurado') trialPlanId.value = ''
      const sut = makeSut(options)

      await expect(sut.state()).resolves.not.toHaveProperty('contact')
      expect(sut.getContact).not.toHaveBeenCalled()
    })
  })
})
