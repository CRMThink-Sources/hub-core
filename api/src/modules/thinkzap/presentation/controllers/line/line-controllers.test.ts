import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
import { GetLineConnectionController } from './get-line-connection.controller'
import { GetLineQrCodeController } from './get-line-qr-code.controller'
import { UpdateLineSettingsController } from './update-line-settings.controller'
import { GetLineConnection } from '@/modules/thinkzap/application/get-line-connection'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const zapiItem: SubscriptionItem = {
  id: 'i1',
  name: 'Linha comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
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

const req = (itemId: string, body: unknown = {}) =>
  ({
    params: { itemId },
    body,
    domainId: 'domain-1',
    appId: 'crmthink.thinkzap',
  }) as unknown as Request

const context = {
  // `name` é o host do portal — é dele que sai o prefixo do nome na Z-API.
  customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
  aplication: { id: 'installed-1', spaId: '42' },
  subscriptions: [
    { id: 'sub-1', status: 'active', items: [zapiItem, hubItem] },
  ],
}

function makeDeps() {
  const execute = vi.fn().mockResolvedValue(context)
  const getInstanceByInstanceId = vi.fn().mockResolvedValue({
    id: 'uuid-1',
    instanceId: 'Z-1',
    settings: {},
    vinculatedChannel: null,
  })
  const getInstance = vi.fn().mockResolvedValue({
    connected: true,
    name: 'acme | Comercial',
    token: 'tk',
  })
  const getPhoneData = vi.fn().mockResolvedValue({ phone: '5511999998888' })
  const getQRCode = vi
    .fn()
    .mockResolvedValue({ value: 'data:image/png;base64,x' })

  return {
    execute,
    getInstanceByInstanceId,
    getInstance,
    getPhoneData,
    getQRCode,
  }
}

describe('GetLineConnectionController', () => {
  let deps: ReturnType<typeof makeDeps>
  let controller: GetLineConnectionController

  beforeEach(() => {
    vi.clearAllMocks()
    deps = makeDeps()
    controller = new GetLineConnectionController(
      new GetLineConnection(
        { execute: deps.execute } as never,
        {
          getInstance: deps.getInstance,
          getPhoneData: deps.getPhoneData,
        } as never,
        { schedule: vi.fn() } as never,
        {
          getConnectionStatus: vi
            .fn()
            .mockResolvedValue({ connected: false, available: true }),
        },
      ),
    )
  })

  it('devolve 200 com o estado da conexão', async () => {
    const response = await controller.perform(req('i1'))

    expect(response.status).toBe(200)
    expect(response.result).toMatchObject({
      connected: true,
      phone: '5511999998888',
    })
  })

  it('não emite token no payload', async () => {
    const response = await controller.perform(req('i1'))

    expect(JSON.stringify(response.result)).not.toContain('TOKEN-SECRETO')
    expect(JSON.stringify(response.result)).not.toContain('token')
  })

  it('devolve 404 para item que não está na instalação do token', async () => {
    const response = await controller.perform(req('de-outro-cliente'))

    expect(response.status).toBe(404)
    expect(deps.getInstance).not.toHaveBeenCalled()
  })

  /**
   * A rota deixou de recusar por provider: a linha oficial tem aba de conexão, e
   * responder "operação indisponível" nela esconderia o estado que o cliente veio
   * ver. O que muda é a fonte — a WABA do item, não a Z-API.
   */
  it('responde o estado da linha oficial sem tocar a Z-API', async () => {
    const response = await controller.perform(req('i2'))

    expect(response.status).toBe(200)
    expect(response.result).toMatchObject({
      provider: 'HUBMESSAGE',
      connected: false,
    })
    expect(deps.getInstance).not.toHaveBeenCalled()
  })

  it('devolve 502 quando a leitura do estado falha, e não 200 desconectado', async () => {
    deps.getInstance.mockRejectedValue(new Error('Failed to get instance data'))

    const response = await controller.perform(req('i1'))

    expect(response.status).toBe(502)
    expect(response.result).not.toMatchObject({ connected: false })
  })
})

describe('GetLineQrCodeController', () => {
  let deps: ReturnType<typeof makeDeps>
  let controller: GetLineQrCodeController

  beforeEach(() => {
    vi.clearAllMocks()
    deps = makeDeps()
    controller = new GetLineQrCodeController(
      { execute: deps.execute } as never,
      { getQRCode: deps.getQRCode } as never,
    )
  })

  it('busca o QR com a credencial resolvida do item', async () => {
    const response = await controller.perform(req('i1'))

    expect(deps.getQRCode).toHaveBeenCalledWith('Z-1', 'TOKEN-SECRETO')
    expect(response.status).toBe(200)
  })

  it('devolve 404 para item fora da instalação', async () => {
    const response = await controller.perform(req('nao-existe'))

    expect(response.status).toBe(404)
    expect(deps.getQRCode).not.toHaveBeenCalled()
  })

  it('devolve 502 quando o provider falha ao gerar o QR', async () => {
    deps.getQRCode.mockRejectedValue(new Error('Failed to get QR code'))

    const response = await controller.perform(req('i1'))

    expect(response.status).toBe(502)
  })
})

describe('UpdateLineSettingsController', () => {
  let deps: ReturnType<typeof makeDeps>
  let updateLineSettings: { execute: ReturnType<typeof vi.fn> }
  let controller: UpdateLineSettingsController

  beforeEach(() => {
    vi.clearAllMocks()
    deps = makeDeps()
    updateLineSettings = { execute: vi.fn().mockResolvedValue(undefined) }
    controller = new UpdateLineSettingsController(
      { execute: deps.execute } as never,
      updateLineSettings as never,
    )
  })

  it('grava nome e settings da linha', async () => {
    const response = await controller.perform(
      req('i1', {
        name: 'Comercial',
        settings: { prefixOperatorNameEnabled: true },
      }),
    )

    expect(response.status).toBe(200)
    expect(updateLineSettings.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'installed-1',
        name: 'Comercial',
        settings: { prefixOperatorNameEnabled: true },
      }),
    )
  })

  it('devolve 400 quando o corpo traz connectorId', async () => {
    const response = await controller.perform(
      req('i1', { connectorId: 'connector-1', name: 'Comercial' }),
    )

    expect(response.status).toBe(400)
    expect(updateLineSettings.execute).not.toHaveBeenCalled()
  })

  it('devolve 400 quando nada é informado', async () => {
    const response = await controller.perform(req('i1', {}))

    expect(response.status).toBe(400)
  })

  it('devolve 400 para nome vazio', async () => {
    const response = await controller.perform(req('i1', { name: '' }))

    expect(response.status).toBe(400)
  })

  it('repassa o limite diário ao caso de uso', async () => {
    const response = await controller.perform(
      req('i2', { settings: { dailyLimitEnabled: true, dailyLimit: 300 } }),
    )

    expect(response.status).toBe(200)
    expect(updateLineSettings.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: { dailyLimitEnabled: true, dailyLimit: 300 },
      }),
    )
  })

  it.each([0, -1, 2.5, '300'])(
    'devolve 400 para limite diário %s',
    async dailyLimit => {
      const response = await controller.perform(
        req('i2', { settings: { dailyLimitEnabled: true, dailyLimit } }),
      )

      expect(response.status).toBe(400)
      expect(updateLineSettings.execute).not.toHaveBeenCalled()
    },
  )

  it('devolve 400 para toggle desconhecido', async () => {
    const response = await controller.perform(
      req('i1', { settings: { naoExiste: true } }),
    )

    expect(response.status).toBe(400)
  })

  /**
   * Antes respondia `409 Linha ainda não provisionada`. Os toggles vivem no item
   * da SPA, então a ausência de registro em `Instance` não é mais impedimento —
   * era exatamente o que fazia a aba Ajustes recusar linha real e conectada.
   */
  it('grava mesmo sem registro em Instance', async () => {
    deps.getInstanceByInstanceId.mockResolvedValue(null)

    const response = await controller.perform(req('i1', { name: 'Comercial' }))

    expect(response.status).toBe(200)
    expect(updateLineSettings.execute).toHaveBeenCalled()
  })

  it('passa o item resolvido e o host do portal para o caso de uso', async () => {
    await controller.perform(
      req('i1', { settings: { widgetOpenChannelEnabled: true } }),
    )

    /**
     * A credencial não é mais repassada solta: o caso de uso recebe o item e decide
     * por provider — Z-API renomeia no provider, HubMessage grava o nome no item.
     */
    expect(updateLineSettings.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        domainName: 'acme.bitrix24.com.br',
        appId: 'installed-1',
      }),
    )
    expect(
      (
        updateLineSettings.execute.mock.calls[0]?.[0] as {
          item: { id: string }
        }
      ).item.id,
    ).toBe('i1')
  })

  it('devolve 404 para item fora da instalação', async () => {
    const response = await controller.perform(
      req('nao-existe', { name: 'Comercial' }),
    )

    expect(response.status).toBe(404)
  })

  /**
   * Ajustes valem para linha oficial também — antes esta superfície era Z-API-only,
   * e o efeito era que a linha HubMessage não tinha onde ser configurada nem
   * vinculada a um canal aberto.
   */
  it('aceita linha HubMessage', async () => {
    const response = await controller.perform(req('i2', { name: 'Oficial' }))

    expect(response.status).toBe(200)
    expect(updateLineSettings.execute).toHaveBeenCalled()
  })

  it('lê o contexto uma vez só', async () => {
    await controller.perform(req('i1', { name: 'Comercial' }))

    expect(deps.execute).toHaveBeenCalledTimes(1)
  })
})
