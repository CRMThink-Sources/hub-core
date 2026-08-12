import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'

// `Controller` arrasta o logger, que lê `logLevel`/`nodeEnv` do mesmo módulo.
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

import { ConnectOfficialLine } from '@/modules/thinkzap/application/connect-official-line'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { ConnectLineChannelController } from './connect-line-channel.controller'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

const SDK_PAYLOAD = { wabaId: 'W-9', phoneId: 'P-9', code: 'CODE-9' }

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

const hubItem = (wabaId?: string) =>
  item({ provider: 'HUBMESSAGE', hubmessageChannelId: 'C-9', wabaId })

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

const req = (body: unknown = SDK_PAYLOAD, itemId = 'i1') =>
  ({
    params: { itemId },
    body,
    query: {},
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
    connectChannel: vi.fn().mockResolvedValue(undefined),
  }

  const subscriptionItems = {
    updateSubscriptionItem: vi.fn().mockResolvedValue(undefined),
  }

  const controller = new ConnectLineChannelController(
    new ConnectOfficialLine(
      getAplicationContext as never,
      hubMessageClient as never,
      subscriptionItems as never,
    ),
  )

  return {
    getAplicationContext,
    hubMessageClient,
    subscriptionItems,
    controller,
  }
}

describe('ConnectLineChannelController', () => {
  let sut: ReturnType<typeof makeSut>

  beforeEach(() => {
    vi.clearAllMocks()
    sut = makeSut()
  })

  it('conecta o canal resolvido no metadata do item e grava a WABA', async () => {
    const response = await sut.controller.perform(req())

    expect(sut.hubMessageClient.connectChannel).toHaveBeenCalledWith('C-9', {
      wabaId: 'W-9',
      phoneId: 'P-9',
      code: 'CODE-9',
      coexistence: false,
    })
    expect(sut.subscriptionItems.updateSubscriptionItem).toHaveBeenCalledWith(
      'i1',
      {
        metadata: {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: 'C-9',
          wabaId: 'W-9',
        },
      },
    )
    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      connected: true,
      wabaId: 'W-9',
      wabaRecorded: true,
    })
  })

  /** O `channelId` sai do item; mandá-lo no corpo não escolhe outro canal. */
  it('ignora channelId enviado no corpo', async () => {
    await sut.controller.perform(req({ ...SDK_PAYLOAD, channelId: 'C-OUTRO' }))

    expect(sut.hubMessageClient.connectChannel).toHaveBeenCalledWith(
      'C-9',
      expect.anything(),
    )
  })

  it('não reescreve o item quando a WABA já é a mesma', async () => {
    sut = makeSut([hubItem('W-9')])

    const response = await sut.controller.perform(req())

    expect(sut.hubMessageClient.connectChannel).toHaveBeenCalled()
    expect(sut.subscriptionItems.updateSubscriptionItem).not.toHaveBeenCalled()
    expect(response.result).toMatchObject({ wabaRecorded: true })
  })

  describe('corpo inválido', () => {
    it.each([
      ['sem wabaId', { phoneId: 'P-9', code: 'CODE-9' }],
      ['sem phoneId', { wabaId: 'W-9', code: 'CODE-9' }],
      ['sem code', { wabaId: 'W-9', phoneId: 'P-9' }],
      ['com campo vazio', { ...SDK_PAYLOAD, code: '' }],
    ])('responde 400 %s, sem tocar a HubMessage', async (_, body) => {
      const response = await sut.controller.perform(req(body))

      expect(response.status).toBe(400)
      expect(sut.hubMessageClient.connectChannel).not.toHaveBeenCalled()
    })
  })

  describe('linha que não é oficial', () => {
    it('recusa item ZAPI com 400, sem tocar a HubMessage', async () => {
      sut = makeSut([zapiItem()])

      const response = await sut.controller.perform(req())

      expect(response.status).toBe(400)
      expect(sut.hubMessageClient.connectChannel).not.toHaveBeenCalled()
    })

    it('responde 404 para item fora da instalação', async () => {
      const response = await sut.controller.perform(
        req(SDK_PAYLOAD, 'de-outro'),
      )

      expect(response.status).toBe(404)
      expect(sut.hubMessageClient.connectChannel).not.toHaveBeenCalled()
    })
  })

  /**
   * A recusa vem antes da HubMessage: o cliente já fez a autenticação Meta, e
   * gastar a chamada para depois recusar não devolveria nada a ele.
   */
  it('responde 402 para linha com o teste encerrado, sem tocar a HubMessage', async () => {
    sut = makeSut([hubItem()], TRIAL_VENCIDO)

    const response = await sut.controller.perform(req())

    expect(response.status).toBe(402)
    expect(response.result).toMatchObject({
      code: 'line-blocked',
      entitlement: 'trial-expired',
    })
    expect(sut.hubMessageClient.connectChannel).not.toHaveBeenCalled()
    expect(sut.subscriptionItems.updateSubscriptionItem).not.toHaveBeenCalled()
  })

  describe('falha da HubMessage', () => {
    it('não grava a WABA e responde 502 quando o provider está fora', async () => {
      sut.hubMessageClient.connectChannel.mockRejectedValue(
        new HubMessageApiError(503, 'POST', '/v1/channels/C-9/connect', {}, {}),
      )

      const response = await sut.controller.perform(req())

      expect(response.status).toBe(502)
      expect(
        sut.subscriptionItems.updateSubscriptionItem,
      ).not.toHaveBeenCalled()
    })

    /** Recusa sobre o que foi enviado — código expirado, WABA de outro cliente. */
    it('responde 400 com a mensagem do provider quando ele recusa', async () => {
      sut.hubMessageClient.connectChannel.mockRejectedValue(
        new HubMessageApiError(
          422,
          'POST',
          '/v1/channels/C-9/connect',
          { error: 'invalid code' },
          {},
        ),
      )

      const response = await sut.controller.perform(req())

      expect(response.status).toBe(400)
      expect(
        sut.subscriptionItems.updateSubscriptionItem,
      ).not.toHaveBeenCalled()
    })
  })

  /**
   * O canal já conectou no provider: virar erro faria o cliente ver falha sobre
   * uma conexão que deu certo. O que a resposta reporta é o que se perdeu.
   */
  it('responde 200 com wabaRecorded false quando a gravação na SPA falha', async () => {
    sut.subscriptionItems.updateSubscriptionItem.mockRejectedValue(
      new Error('Bitrix indisponível'),
    )

    const response = await sut.controller.perform(req())

    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      connected: true,
      wabaId: 'W-9',
      wabaRecorded: false,
    })
  })
})
