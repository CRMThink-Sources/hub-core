import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

vi.mock('@/config/env', () => ({
  env: {
    logLevel: 'silent',
    nodeEnv: 'test',
    lokiUrl: '',
    bitrix: { connector: { code: 'thinkzap' } },
  },
}))

import { Request } from 'express'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

import { CheckConnectOrigin } from '@/modules/thinkzap/application/check-connect-origin'
import { CheckConnectOriginController } from './check-connect-origin.controller'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

const item = (
  metadata: SubscriptionItem['metadata'],
  id = 'i1',
): SubscriptionItem => ({
  id,
  name: 'Linha oficial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata,
})

const hubItem = () =>
  item({ provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9' })

const zapiItem = () =>
  item({
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  })

const ATIVA = {
  status: 'trialing',
  currentPeriodStart: new Date(NOW - DAY),
  currentPeriodEnd: new Date(NOW + DAY),
}

const TRIAL_VENCIDO = {
  status: 'trialing',
  currentPeriodStart: new Date(NOW - 4 * DAY),
  currentPeriodEnd: new Date(NOW - DAY),
}

const ORIGIN = 'https://acme.bitrix24.com.br'

const req = (query: unknown = { origin: ORIGIN }, itemId = 'i1') =>
  ({
    params: { itemId },
    query,
    body: {},
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

function makeSut(
  items: SubscriptionItem[] = [hubItem()],
  subscription: Record<string, unknown> = ATIVA,
) {
  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
      aplication: { id: 'installed-1', spaId: '42' },
      subscriptions: [{ id: 'sub-1', ...subscription, items }],
    }),
  }
  const hubMessageClient = {
    getSdkInfo: vi.fn().mockResolvedValue({ allowOrigins: [ORIGIN] }),
  }
  const controller = new CheckConnectOriginController(
    new CheckConnectOrigin(getAplicationContext as never, hubMessageClient),
  )

  return { getAplicationContext, hubMessageClient, controller }
}

describe('CheckConnectOriginController', () => {
  let sut: ReturnType<typeof makeSut>

  beforeEach(() => {
    vi.clearAllMocks()
    sut = makeSut()
  })

  it('libera origem presente em allowOrigins, consultando o canal do item', async () => {
    const response = await sut.controller.perform(req())

    expect(sut.hubMessageClient.getSdkInfo).toHaveBeenCalledWith('C-9')
    expect(response.status).toBe(200)
    expect(response.result).toEqual({ allowed: true })
  })

  it('ignora barra final nos dois lados', async () => {
    sut.hubMessageClient.getSdkInfo.mockResolvedValue({
      allowOrigins: [`${ORIGIN}/`],
    })

    const response = await sut.controller.perform(req())

    expect(response.result).toEqual({ allowed: true })
  })

  it('recusa origem fora de uma lista não vazia', async () => {
    sut.hubMessageClient.getSdkInfo.mockResolvedValue({
      allowOrigins: ['https://outro.com'],
    })

    const response = await sut.controller.perform(req())

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ allowed: false })
  })

  it.each([[{ allowOrigins: [] }], [{}]])(
    'libera quando a lista de origens é vazia ou ausente (%j)',
    async info => {
      sut.hubMessageClient.getSdkInfo.mockResolvedValue(info)

      const response = await sut.controller.perform(req())

      expect(response.result).toEqual({ allowed: true })
    },
  )

  it.each([
    ['rede', new Error('ECONNRESET')],
    ['timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })],
    ['401', Object.assign(new Error('401'), { status: 401 })],
    ['404', Object.assign(new Error('404'), { status: 404 })],
    ['5xx', Object.assign(new Error('502'), { status: 502 })],
  ])('libera o fluxo quando sdk-info falha por %s', async (_, error) => {
    sut.hubMessageClient.getSdkInfo.mockRejectedValue(error)

    const response = await sut.controller.perform(req())

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ allowed: true })
  })

  it('normaliza a origem enviada, descartando o caminho', async () => {
    const response = await sut.controller.perform(
      req({ origin: `${ORIGIN}/thinkzap?x=1` }),
    )

    expect(response.result).toEqual({ allowed: true })
  })

  describe('origem inválida', () => {
    it.each([
      ['ausente', {}],
      ['vazia', { origin: '' }],
      ['sem protocolo', { origin: 'acme.bitrix24.com.br' }],
      ['protocolo não http', { origin: 'javascript:alert(1)' }],
    ])('responde 400 com origin %s, sem consultar a Omni', async (_, query) => {
      const response = await sut.controller.perform(req(query))

      expect(response.status).toBe(400)
      expect(sut.hubMessageClient.getSdkInfo).not.toHaveBeenCalled()
    })
  })

  it('recusa linha de outro provider, sem consultar a Omni', async () => {
    sut = makeSut([zapiItem()])

    const response = await sut.controller.perform(req())

    expect(response.status).toBe(400)
    expect(sut.hubMessageClient.getSdkInfo).not.toHaveBeenCalled()
  })

  it('responde 404 para item fora da instalação', async () => {
    const response = await sut.controller.perform(req(undefined, 'i-alheio'))

    expect(response.status).toBe(404)
    expect(sut.hubMessageClient.getSdkInfo).not.toHaveBeenCalled()
  })

  it('recusa linha bloqueada (teste encerrado) sem consultar a Omni', async () => {
    sut = makeSut([hubItem()], TRIAL_VENCIDO)

    const response = await sut.controller.perform(req())

    expect(response.status).toBe(402)
    expect(sut.hubMessageClient.getSdkInfo).not.toHaveBeenCalled()
  })
})
