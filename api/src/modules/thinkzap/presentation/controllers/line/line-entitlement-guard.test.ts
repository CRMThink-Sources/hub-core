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
import type { LineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { httpResponse } from '@/shared/helpers/http'

import { GetLineConnection } from '@/modules/thinkzap/application/get-line-connection'
import { GetLineSettings } from '@/modules/thinkzap/application/get-line-settings'
import { CreateGroupService } from '@/modules/thinkzap/application/create-group.service'
import { ListGroupsService } from '@/modules/thinkzap/application/list-groups.service'
import { CreateConnectorTemplateUseCase } from '@/modules/thinkzap/application/create-connector-template'
import { ListConnectorTemplatesUseCase } from '@/modules/thinkzap/application/list-connector-templates'
import { SyncConnectorTemplatesUseCase } from '@/modules/thinkzap/application/sync-connector-templates'

import { GetLineConnectionController } from './get-line-connection.controller'
import { GetLineQrCodeController } from './get-line-qr-code.controller'
import { GetLineSettingsController } from './get-line-settings.controller'
import { UpdateLineSettingsController } from './update-line-settings.controller'
import { LinkLineChannelController } from './link-line-channel.controller'
import { UnlinkLineChannelController } from './unlink-line-channel.controller'
import { CreateGroupController } from '../create-group.controller'
import { ListGroupsController } from '../list-groups.controller'
import { CreateTemplateController } from '../connector/create-template.controller'
import { ListTemplatesController } from '../connector/list-templates.controller'
import { SyncTemplatesController } from '../connector/sync-templates.controller'

/**
 * Bloqueio de configuração, rota por rota.
 *
 * Uma linha só existe por assinatura, e é a assinatura que diz se ela funciona. Este
 * arquivo cobre o eixo que os testes de cada controller não cobrem: **o mesmo item,
 * a mesma request, três assinaturas diferentes**.
 *
 * `inactive` está aqui junto de `trial-expired` de propósito. A tela trata os dois
 * de forma diferente, mas o bloqueio não: assinatura cancelada e teste vencido
 * recusam a mesma coisa, e testar só o trial deixaria o caminho pago sem cobertura.
 */

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
    zApiInstanceToken: 'TOKEN-SECRETO',
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
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
}

/**
 * Assinatura que produz cada entitlement.
 *
 * `trial-expired` é `trialing` com a janela no passado — o `status` persistido
 * continua dizendo `trialing` depois de vencer, e é isso que faz a janela ser a
 * verdade em vez do campo.
 */
const SUBSCRIPTION_BY_ENTITLEMENT: Record<
  LineEntitlement,
  { status: string; currentPeriodStart: Date; currentPeriodEnd: Date }
> = {
  active: {
    status: 'trialing',
    currentPeriodStart: new Date(NOW - DAY),
    currentPeriodEnd: new Date(NOW + DAY),
  },
  'trial-expired': {
    status: 'trialing',
    currentPeriodStart: new Date(NOW - 4 * DAY),
    currentPeriodEnd: new Date(NOW - DAY),
  },
  inactive: {
    status: 'cancelled',
    currentPeriodStart: new Date(NOW - 4 * DAY),
    currentPeriodEnd: new Date(NOW + DAY),
  },
}

const BLOCKED: LineEntitlement[] = ['trial-expired', 'inactive']

const context = (entitlement: LineEntitlement) => ({
  customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
  aplication: { id: 'installed-1', spaId: '42' },
  subscriptions: [
    {
      id: 'sub-1',
      ...SUBSCRIPTION_BY_ENTITLEMENT[entitlement],
      items: [zapiItem, hubItem],
    },
  ],
})

const req = (itemId: string, body: unknown = {}) =>
  ({
    params: { itemId },
    body,
    query: {},
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

function makeDeps(entitlement: LineEntitlement) {
  const getAplicationContext = {
    execute: vi.fn().mockResolvedValue(context(entitlement)),
  }

  const zApiClient = {
    getInstance: vi.fn().mockResolvedValue({
      connected: true,
      name: 'acme | Comercial',
      token: 'tk',
    }),
    getPhoneData: vi.fn().mockResolvedValue({ phone: '5511999998888' }),
    getQRCode: vi.fn().mockResolvedValue({ value: 'data:image/png;base64,x' }),
    createGroup: vi
      .fn()
      .mockResolvedValue({ phone: 'g-1', invitationLink: 'https://chat/g-1' }),
    listGroups: vi.fn().mockResolvedValue([]),
  }

  const items = { updateSubscriptionItem: vi.fn().mockResolvedValue(undefined) }

  const instances = {
    getInstance: vi.fn().mockResolvedValue(null),
    getInstanceByInstanceId: vi.fn().mockResolvedValue({ id: 'uuid-1' }),
    getInstanceByChannelId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'uuid-1' }),
    updateVinculatedChannel: vi.fn().mockResolvedValue({ id: 'uuid-1' }),
    markAsDisconnected: vi.fn().mockResolvedValue({ id: 'uuid-1' }),
    markAsConnected: vi.fn().mockResolvedValue({ id: 'uuid-1' }),
  }

  const bitrixClient = {
    activateConnector: vi.fn().mockResolvedValue(undefined),
  }

  const updateLineSettings = { execute: vi.fn().mockResolvedValue(undefined) }

  /** A desconexão na expiração é medida em `disconnect-expired-line.test.ts`. */
  const disconnectExpiredLine = { schedule: vi.fn() }

  const templateProvider = {
    listTemplates: vi
      .fn()
      .mockResolvedValue([{ name: 'boas_vindas', components: [] }]),
    createTemplate: vi.fn().mockResolvedValue({ id: 't-1' }),
    syncTemplates: vi.fn().mockResolvedValue([]),
  }
  const templateProviderResolver = {
    resolve: vi.fn().mockReturnValue(templateProvider),
  }

  const ctx = getAplicationContext as never
  const zapi = zApiClient as never

  return {
    getAplicationContext,
    zApiClient,
    items,
    instances,
    bitrixClient,
    updateLineSettings,
    templateProvider,

    updateSettings: new UpdateLineSettingsController(
      ctx,
      updateLineSettings as never,
    ),
    linkChannel: new LinkLineChannelController(
      ctx,
      items as never,
      instances as never,
      bitrixClient as never,
    ),
    unlinkChannel: new UnlinkLineChannelController(
      ctx,
      items as never,
      instances as never,
      bitrixClient as never,
    ),
    qrCode: new GetLineQrCodeController(ctx, zapi),
    getSettings: new GetLineSettingsController(new GetLineSettings(ctx)),
    getConnection: new GetLineConnectionController(
      new GetLineConnection(ctx, zapi, disconnectExpiredLine as never, {
        getConnectionStatus: vi
          .fn()
          .mockResolvedValue({ connected: true, available: true }),
      }),
    ),
    createGroup: new CreateGroupController(new CreateGroupService(ctx, zapi)),
    listGroups: new ListGroupsController(new ListGroupsService(ctx, zapi)),
    createTemplate: new CreateTemplateController(
      new CreateConnectorTemplateUseCase(
        ctx,
        templateProviderResolver as never,
        { fetch: vi.fn() },
      ),
    ),
    listTemplates: new ListTemplatesController(
      new ListConnectorTemplatesUseCase(ctx, templateProviderResolver as never),
    ),
    syncTemplates: new SyncTemplatesController(
      new SyncConnectorTemplatesUseCase(ctx, templateProviderResolver as never),
    ),
  }
}

type Deps = ReturnType<typeof makeDeps>

/** Cada escrita, com o que **não** pode ter acontecido quando ela é recusada. */
const WRITES: Array<{
  name: string
  perform: (deps: Deps) => Promise<httpResponse>
  assertNoEffect: (deps: Deps) => void
}> = [
  {
    name: 'PATCH /lines/:itemId/settings',
    perform: deps =>
      deps.updateSettings.perform(req('i1', { name: 'Comercial' })),
    assertNoEffect: deps =>
      expect(deps.updateLineSettings.execute).not.toHaveBeenCalled(),
  },
  {
    name: 'POST /lines/:itemId/channel',
    perform: deps => deps.linkChannel.perform(req('i1', { lineId: 7 })),
    assertNoEffect: deps => {
      // Nada ativado no Bitrix, e nada gravado no item.
      expect(deps.bitrixClient.activateConnector).not.toHaveBeenCalled()
      expect(deps.items.updateSubscriptionItem).not.toHaveBeenCalled()
    },
  },
  {
    name: 'DELETE /lines/:itemId/channel',
    perform: deps => deps.unlinkChannel.perform(req('i1')),
    assertNoEffect: deps => {
      expect(deps.bitrixClient.activateConnector).not.toHaveBeenCalled()
      expect(deps.items.updateSubscriptionItem).not.toHaveBeenCalled()
    },
  },
  {
    name: 'GET /lines/:itemId/qr-code',
    perform: deps => deps.qrCode.perform(req('i1')),
    // Sem consultar o provider: recusada não gasta requisição na Z-API.
    assertNoEffect: deps =>
      expect(deps.zApiClient.getQRCode).not.toHaveBeenCalled(),
  },
  {
    name: 'POST /lines/:itemId/groups',
    perform: deps =>
      deps.createGroup.perform(
        req('i1', {
          groupName: 'Equipe',
          autoInvite: true,
          phones: ['5511988887777'],
        }),
        undefined as never,
      ),
    assertNoEffect: deps => {
      expect(deps.zApiClient.createGroup).not.toHaveBeenCalled()
      expect(deps.zApiClient.getInstance).not.toHaveBeenCalled()
    },
  },
  {
    name: 'GET /lines/:itemId/groups',
    perform: deps => deps.listGroups.perform(req('i1'), undefined as never),
    assertNoEffect: deps =>
      expect(deps.zApiClient.listGroups).not.toHaveBeenCalled(),
  },
  {
    name: 'POST /lines/:itemId/templates',
    perform: deps =>
      deps.createTemplate.perform(
        req('i2', {
          name: 'boas_vindas',
          category: 'UTILITY',
          language: 'pt_BR',
          components: [{ type: 'BODY', text: 'Olá' }],
        }),
      ),
    assertNoEffect: deps =>
      expect(deps.templateProvider.createTemplate).not.toHaveBeenCalled(),
  },
  {
    name: 'POST /lines/:itemId/templates/sync',
    perform: deps => deps.syncTemplates.perform(req('i2')),
    assertNoEffect: deps =>
      expect(deps.templateProvider.syncTemplates).not.toHaveBeenCalled(),
  },
]

describe('bloqueio de configuração por entitlement', () => {
  beforeEach(() => vi.clearAllMocks())

  describe.each(WRITES)('$name', ({ perform, assertNoEffect }) => {
    it('responde 200 com a linha habilitada', async () => {
      const response = await perform(makeDeps('active'))

      expect(response.status).toBe(200)
    })

    it.each(BLOCKED)('recusa com entitlement %s', async entitlement => {
      const deps = makeDeps(entitlement)

      const response = await perform(deps)

      expect(response.status).toBe(402)
      assertNoEffect(deps)
    })

    it('identifica o bloqueio no corpo, não só no status', async () => {
      const response = await perform(makeDeps('trial-expired'))

      expect(response.result).toMatchObject({
        code: 'line-blocked',
        entitlement: 'trial-expired',
      })
    })
  })

  /**
   * `402` em toda rota, com o mesmo `code`: linha bloqueada é um caso só, e a tela
   * não pode ter que aprender uma resposta por rota. Se uma superfície nova
   * responder diferente, este teste é o que reclama.
   */
  it('responde igual em todas as rotas de escrita', async () => {
    const responses = await Promise.all(
      WRITES.map(write => write.perform(makeDeps('trial-expired'))),
    )

    const shapes = responses.map(response => ({
      status: response.status,
      code: (response.result as { code?: string }).code,
      entitlement: (response.result as { entitlement?: string }).entitlement,
    }))

    expect(shapes).toEqual(
      shapes.map(() => ({
        status: 402,
        code: 'line-blocked',
        entitlement: 'trial-expired',
      })),
    )
  })

  /**
   * O outro lado do bloqueio, e o que impede ele de virar perda de dado: o cliente
   * tem que conseguir ver o que tinha e por que parou.
   */
  describe('leitura preservada', () => {
    const ENTITLEMENTS: LineEntitlement[] = [
      'active',
      'trial-expired',
      'inactive',
    ]

    it.each(ENTITLEMENTS)(
      'GET /lines/:itemId/settings responde 200 com entitlement %s no payload',
      async entitlement => {
        const deps = makeDeps(entitlement)

        const response = await deps.getSettings.perform(req('i1'))

        expect(response.status).toBe(200)
        expect(response.result).toMatchObject({ entitlement })
      },
    )

    it.each(ENTITLEMENTS)(
      'GET /lines/:itemId/connection responde 200 com entitlement %s no payload',
      async entitlement => {
        const deps = makeDeps(entitlement)

        const response = await deps.getConnection.perform(req('i1'))

        expect(response.status).toBe(200)
        expect(response.result).toMatchObject({ entitlement })
      },
    )

    /** Listar template é leitura, e continua permitido — só criar e sincronizar recusam. */
    it.each(ENTITLEMENTS)(
      'GET /lines/:itemId/templates responde 200 com entitlement %s',
      async entitlement => {
        const deps = makeDeps(entitlement)

        const response = await deps.listTemplates.perform(req('i2'))

        expect(response.status).toBe(200)
        expect(deps.templateProvider.listTemplates).toHaveBeenCalled()
      },
    )
  })
})
