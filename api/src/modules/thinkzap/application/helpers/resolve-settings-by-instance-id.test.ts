import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSettingsByInstanceId } from './resolve-settings-by-instance-id'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const warn = vi.fn()
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: {
    warn: (...args: unknown[]): void => {
      warn(...args)
    },
    info: vi.fn(),
    error: vi.fn(),
  },
}))

const zapiItem = (
  id: string,
  instanceId: string,
  settings = DEFAULT_CONNECTOR_SETTINGS,
): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status: 'active',
  settings: { ...settings },
  vinculatedChannel: null,
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: instanceId,
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
})

const hubItem = (id: string): SubscriptionItem => ({
  id,
  name: `Linha ${id}`,
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS },
  vinculatedChannel: null,
  metadata: {
    provider: 'HUBMESSAGE',
    hubmessageChannelId: 'C-9',
    wabaId: 'W-9',
  },
})

const input = {
  instanceId: 'Z-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

function makeSut(items: SubscriptionItem[] = [zapiItem('i1', 'Z-1')]) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [{ id: 'sub-1', items }],
  })

  return {
    execute,
    resolve: (overrides: Partial<typeof input> = {}) =>
      resolveSettingsByInstanceId({ ...input, ...overrides }, {
        execute,
      } as never),
  }
}

describe('resolveSettingsByInstanceId', () => {
  beforeEach(() => warn.mockClear())

  it('devolve os settings do item cuja credencial casa com o instanceId', async () => {
    const settings = {
      ...DEFAULT_CONNECTOR_SETTINGS,
      widgetOpenChannelEnabled: true,
    }
    const sut = makeSut([zapiItem('i1', 'Z-1', settings)])

    await expect(sut.resolve()).resolves.toEqual(settings)
  })

  it('escopa a busca à instalação do par (domainId, appCode)', async () => {
    const sut = makeSut()

    await sut.resolve()

    expect(sut.execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
    expect(sut.execute).toHaveBeenCalledTimes(1)
  })

  it('ignora itens de outra instância', async () => {
    const sut = makeSut([
      zapiItem('i1', 'Z-OUTRA', {
        ...DEFAULT_CONNECTOR_SETTINGS,
        widgetOpenChannelEnabled: true,
      }),
      zapiItem('i2', 'Z-1'),
    ])

    await expect(sut.resolve()).resolves.toEqual(DEFAULT_CONNECTOR_SETTINGS)
  })

  it('ignora itens de provider não-Z-API', async () => {
    const sut = makeSut([hubItem('i1')])

    await expect(sut.resolve()).resolves.toEqual(DEFAULT_CONNECTOR_SETTINGS)
  })

  /**
   * Um webhook não pode falhar porque a linha sumiu da SPA — o default é o
   * comportamento conservador dos quatro toggles.
   */
  it('devolve os defaults quando nenhum item corresponde, sem lançar', async () => {
    const sut = makeSut([])

    await expect(sut.resolve()).resolves.toEqual(DEFAULT_CONNECTOR_SETTINGS)
  })

  it('propaga falha de leitura do contexto em vez de degradar para default', async () => {
    const sut = makeSut()
    sut.execute.mockRejectedValue(new Error('Bitrix indisponível'))

    await expect(sut.resolve()).rejects.toThrow('Bitrix indisponível')
  })

  it('usa o primeiro match e avisa quando dois itens têm a mesma credencial', async () => {
    const primeiro = {
      ...DEFAULT_CONNECTOR_SETTINGS,
      prefixOperatorNameEnabled: true,
    }
    const sut = makeSut([
      zapiItem('i1', 'Z-1', primeiro),
      zapiItem('i2', 'Z-1'),
    ])

    await expect(sut.resolve()).resolves.toEqual(primeiro)
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'Z-1', itemIds: ['i1', 'i2'] }),
      expect.stringContaining('mesmo zApiInstanceId'),
    )
  })

  it('não avisa quando há um match só', async () => {
    const sut = makeSut()

    await sut.resolve()

    expect(warn).not.toHaveBeenCalled()
  })
})
