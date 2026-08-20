import { Request } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { ActivateTrialController } from './activate-trial.controller'
import {
  TrialContactWriteFailedError,
  TrialNotEligibleError,
} from '@/modules/thinkzap/application/activate-connector-trial'
import { TrialPlanMissingError } from '@/modules/thinkzap/application/helpers/ensure-trial-plan'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const CONTACT = {
  name: 'Joana Silva',
  email: 'joana@acme.com',
  phone: '(11) 99999-8888',
  company: 'Acme LTDA',
}

const body = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  provider: ConnectorProvider.ZAPI,
  ...CONTACT,
  ...overrides,
})

function req(payload: unknown): Request {
  return {
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
    body: payload,
  } as unknown as Request
}

function makeSut(activateRejects?: Error) {
  const execute = activateRejects
    ? vi.fn().mockRejectedValue(activateRejects)
    : vi.fn().mockResolvedValue({
        subscriptionId: 'sub-1',
        item: { id: 'item-1', name: 'WhatsApp (teste)' },
        currentPeriodEnd: new Date('2026-08-06T12:00:00.000Z'),
      })

  return {
    execute,
    sut: new ActivateTrialController({ execute } as never),
  }
}

describe('ActivateTrialController', () => {
  it('ativa com provider e contato completos', async () => {
    const { sut, execute } = makeSut()

    const response = await sut.perform(req(body()))

    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        domainId: 'domain-1',
        appCode: 'crmthink.thinkzap',
        provider: ConnectorProvider.ZAPI,
      }),
    )
  })

  /** O que vai ao CRM é o número em E.164, não o que o cliente digitou. */
  it('entrega o telefone normalizado ao caso de uso', async () => {
    const { sut, execute } = makeSut()

    await sut.perform(req(body({ phone: '(11) 99999-8888' })))

    const [input] = execute.mock.calls[0] as unknown as [
      { contact: { phone: string } },
    ]

    expect(input.contact.phone).toBe('5511999998888')
  })

  it.each(['name', 'email', 'phone', 'company'])(
    'recusa quando %s está ausente',
    async field => {
      const payload = body()
      delete payload[field]

      const { sut, execute } = makeSut()
      const response = await sut.perform(req(payload))

      expect(response.status).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['name', '   '],
    ['email', 'joana@'],
    ['phone', '1234'],
    ['company', ' '],
  ])('recusa %s inválido e nomeia o campo', async (field, value) => {
    const { sut, execute } = makeSut()

    const response = await sut.perform(req(body({ [field]: value })))

    expect(response.status).toBe(400)
    expect(response.result).toMatchObject({ field })
    expect(execute).not.toHaveBeenCalled()
  })

  /** O corpo aceito antes desta change. Exigir contato não é retrocompatível. */
  it('recusa o corpo com só o provider', async () => {
    const { sut, execute } = makeSut()

    const response = await sut.perform(
      req({ provider: ConnectorProvider.ZAPI }),
    )

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('recusa campo desconhecido no corpo', async () => {
    const { sut, execute } = makeSut()

    const response = await sut.perform(
      req(body({ currentPeriodEnd: '2030-01-01' })),
    )

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('recusa provider inválido', async () => {
    const { sut, execute } = makeSut()

    const response = await sut.perform(req(body({ provider: 'TWILIO' })))

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it('responde 409 para instalação inelegível', async () => {
    const { sut } = makeSut(new TrialNotEligibleError('has-contract'))

    const response = await sut.perform(req(body()))

    expect(response.status).toBe(409)
    expect(response.result).toMatchObject({ reason: 'has-contract' })
  })

  /** Requisição correta, CRM interno é que não respondeu — retentável. */
  it('responde 502 quando a gravação do contato falha', async () => {
    const { sut } = makeSut(new TrialContactWriteFailedError(new Error('bx')))

    const response = await sut.perform(req(body()))

    expect(response.status).toBe(502)
  })

  it('responde 503 quando o plano de trial não está configurado', async () => {
    const { sut } = makeSut(new TrialPlanMissingError('3', 'item não existe'))

    const response = await sut.perform(req(body()))

    expect(response.status).toBe(503)
  })

  it('recusa quando a instalação não vem no token', async () => {
    const { sut, execute } = makeSut()

    const response = await sut.perform({
      body: body(),
    } as unknown as Request)

    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })
})
