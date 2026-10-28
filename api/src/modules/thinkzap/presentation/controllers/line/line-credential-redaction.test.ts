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
import type { httpResponse } from '@/shared/helpers/http'

import { GetLineConnection } from '@/modules/thinkzap/application/get-line-connection'
import { GetLineSettings } from '@/modules/thinkzap/application/get-line-settings'
import { GetConnectorTrialState } from '@/modules/thinkzap/application/get-connector-trial-state'
import { ListConnectorTemplatesUseCase } from '@/modules/thinkzap/application/list-connector-templates'

import { GetLineConnectionController } from './get-line-connection.controller'
import { GetLineSettingsController } from './get-line-settings.controller'
import { UpdateLineSettingsController } from './update-line-settings.controller'
import { GetLineQrCodeController } from './get-line-qr-code.controller'
import { ListTemplatesController } from '../connector/list-templates.controller'
import { GetTrialStateController } from '../trial/get-trial-state.controller'

/**
 * **Nenhuma credencial de provider sai desta superfície.**
 *
 * A resolução da linha devolve o item inteiro, e o item carrega `zApiInstanceToken`
 * no `metadata` — então cada payload aqui nasce a um spread de distância de vazar a
 * credencial de acesso à instância WhatsApp do cliente. A defesa são os mappers, que
 * montam campo por campo; este arquivo é o que reclama quando alguém troca isso por
 * um spread.
 *
 * Roda em **todos** os entitlements: a linha bloqueada continua respondendo às
 * leituras, e é exatamente o caminho novo — o que este teste não cobrisse seria o
 * único sem cobertura de redação.
 */

/** Marcas sintéticas: qualquer uma no payload é vazamento, não coincidência. */
const SECRETS = [
  'TOKEN-ZAPI-SUPER-SECRETO',
  'WABA-ID-SECRETO',
  'CANAL-HUBMESSAGE-SECRETO',
]

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()

const zapiItem: SubscriptionItem = {
  id: 'i1',
  name: 'Linha comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: '7',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-ZAPI-SUPER-SECRETO',
  },
}

const hubItem: SubscriptionItem = {
  id: 'i2',
  name: 'Linha oficial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'CANAL-HUBMESSAGE-SECRETO',
    wabaId: 'WABA-ID-SECRETO',
  },
}

const SUBSCRIPTIONS = {
  active: { status: 'active', currentPeriodEnd: new Date(NOW + DAY) },
  'trial-expired': {
    status: 'trialing',
    currentPeriodEnd: new Date(NOW - DAY),
  },
  inactive: { status: 'cancelled', currentPeriodEnd: new Date(NOW + DAY) },
} as const

type Case = keyof typeof SUBSCRIPTIONS

const req = (itemId: string, body: unknown = {}) =>
  ({
    params: { itemId },
    body,
    query: {},
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

function makeSurface(entitlement: Case) {
  const ctx = {
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
      aplication: { id: 'installed-1', spaId: '42' },
      subscriptions: [
        {
          id: 'sub-1',
          ...SUBSCRIPTIONS[entitlement],
          currentPeriodStart: new Date(NOW - 4 * DAY),
          plan: { id: 'plan-1', name: 'Trial ThinkZap' },
          items: [zapiItem, hubItem],
        },
      ],
    }),
  } as never

  /** A resposta crua da Z-API traz `token` — é o vazamento mais fácil de cometer. */
  const zApiClient = {
    getInstance: vi.fn().mockResolvedValue({
      connected: true,
      name: 'acme | Comercial',
      token: 'TOKEN-ZAPI-SUPER-SECRETO',
    }),
    getPhoneData: vi.fn().mockResolvedValue({ phone: '5511999998888' }),
    getQRCode: vi.fn().mockResolvedValue({ value: 'data:image/png;base64,x' }),
  } as never

  const templateProvider = {
    listTemplates: vi
      .fn()
      .mockResolvedValue([{ name: 'boas_vindas', components: [] }]),
  }

  const plans = {
    getPlan: vi
      .fn()
      .mockResolvedValue({ id: 'plan-1', name: 'Trial ThinkZap' }),
    listPlans: vi.fn().mockResolvedValue([]),
  } as never

  const disconnectExpiredLine = { schedule: vi.fn() } as never

  const contacts = {
    getContact: vi.fn().mockResolvedValue({
      name: 'Joana Silva',
      email: 'joana@acme.com',
      phone: '5511999998888',
      company: 'Acme LTDA',
    }),
  } as never

  const calls: Array<{ route: string; perform: () => Promise<httpResponse> }> =
    [
      {
        route: 'GET /lines/:itemId/settings',
        perform: () =>
          new GetLineSettingsController(new GetLineSettings(ctx)).perform(
            req('i1'),
          ),
      },
      {
        route: 'GET /lines/:itemId/settings (linha oficial)',
        perform: () =>
          new GetLineSettingsController(new GetLineSettings(ctx)).perform(
            req('i2'),
          ),
      },
      {
        route: 'GET /lines/:itemId/connection',
        perform: () =>
          new GetLineConnectionController(
            new GetLineConnection(ctx, zApiClient, disconnectExpiredLine, {
              getConnectionStatus: vi.fn(),
            }),
          ).perform(req('i1')),
      },
      {
        route: 'GET /lines/:itemId/qr-code',
        perform: () =>
          new GetLineQrCodeController(ctx, zApiClient).perform(req('i1')),
      },
      {
        route: 'GET /lines/:itemId/templates',
        perform: () =>
          new ListTemplatesController(
            new ListConnectorTemplatesUseCase(ctx, {
              resolve: vi.fn().mockReturnValue(templateProvider),
            } as never),
          ).perform(req('i2')),
      },
      {
        route: 'PATCH /lines/:itemId/settings',
        perform: () =>
          new UpdateLineSettingsController(ctx, {
            execute: vi.fn().mockResolvedValue(undefined),
          } as never).perform(req('i1', { name: 'Comercial' })),
      },
      {
        route: 'GET /trial',
        perform: () =>
          new GetTrialStateController(
            new GetConnectorTrialState(ctx, plans, contacts),
          ).perform(req('i1')),
      },
    ]

  return calls
}

describe('credencial de provider não sai da superfície de linha', () => {
  beforeEach(() => vi.clearAllMocks())

  const CASES: Case[] = ['active', 'trial-expired', 'inactive']

  describe.each(CASES)('com entitlement %s', entitlement => {
    it.each(makeSurface(entitlement).map(call => call.route))(
      '%s não emite nenhum segredo',
      async route => {
        const call = makeSurface(entitlement).find(
          candidate => candidate.route === route,
        )!

        const response = await call.perform()
        const payload = JSON.stringify(response.result)

        for (const secret of SECRETS) {
          expect(payload).not.toContain(secret)
        }
      },
    )
  })

  /**
   * A chave, não só o valor. `token` no payload é campo que a próxima pessoa vai
   * preencher, mesmo vazio agora — e um `token: ''` numa resposta convida a
   * "consertar" preenchendo.
   */
  it('não emite a chave `token` em nenhuma resposta de leitura', async () => {
    for (const call of makeSurface('trial-expired')) {
      const response = await call.perform()

      // O QR code é `data:image/png;base64,...` e não tem por que mencionar token.
      expect(JSON.stringify(response.result)).not.toContain('token')
    }
  })
})
