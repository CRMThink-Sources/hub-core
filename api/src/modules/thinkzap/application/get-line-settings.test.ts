import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GetLineSettings } from './get-line-settings'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { mapLineSettingsToView } from '@/modules/thinkzap/presentation/mappers/line-settings.mapper'

const { apiLogger } = vi.hoisted(() => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/shared/infra/logger', () => ({ apiLogger }))

const zapiItem: SubscriptionItem = {
  id: 'i1',
  name: 'Comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS, widgetOpenChannelEnabled: true },
  vinculatedChannel: '132',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
}

const oficialItem: SubscriptionItem = {
  ...zapiItem,
  name: 'Oficial vendas',
  metadata: { provider: 'HUBMESSAGE', hubmessageChannelId: 'CH-1' },
}

const input = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

function makeSut(items: SubscriptionItem[] = [zapiItem]) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [{ id: 'sub-1', status: 'active', items }],
  })

  return { execute, sut: new GetLineSettings({ execute } as never) }
}

describe('GetLineSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devolve o nome da linha não oficial a partir do item', async () => {
    const { sut } = makeSut()

    const reading = await sut.execute(input)

    expect(reading.name).toBe('Comercial')
  })

  it('devolve o nome da linha oficial a partir do item', async () => {
    const { sut } = makeSut([oficialItem])

    const reading = await sut.execute(input)

    expect(reading.name).toBe('Oficial vendas')
  })

  /**
   * O construtor não recebe mais `ZApiClient`. O teste trava a aridade: reintroduzir
   * a leitura remota do nome traria de volta a chamada por abertura de aba e o `502`
   * que derrubava a aba inteira com o provider fora.
   */
  it('não depende de nenhum cliente de provider', () => {
    expect(GetLineSettings.length).toBe(1)
  })

  it('devolve toggles, vínculo e habilitação junto do nome', async () => {
    const { sut } = makeSut()

    const reading = await sut.execute(input)

    expect(reading).toEqual({
      name: 'Comercial',
      settings: zapiItem.settings,
      vinculatedChannel: '132',
      entitlement: 'active',
      provider: 'ZAPI',
      dailyLimit: null,
    })
  })

  it('lê o contexto uma vez por chamada', async () => {
    const { sut, execute } = makeSut()

    await sut.execute(input)

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith({
      domainId: 'domain-1',
      appCode: 'crmthink.thinkzap',
    })
  })
})

describe('GetLineSettings (limite diário)', () => {
  const contextWith = (items: SubscriptionItem[]) => ({
    execute: vi.fn().mockResolvedValue({
      customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
      aplication: { id: 'installed-1', spaId: '42' },
      subscriptions: [{ id: 'sub-1', status: 'active', items }],
    }),
  })

  const quotaWith = (impl: DailySendQuota['usage']) => {
    const usage = vi.fn(impl)
    return { quota: { usage } as unknown as DailySendQuota, usage }
  }

  const limited: SubscriptionItem = {
    ...zapiItem,
    settings: {
      ...DEFAULT_CONNECTOR_SETTINGS,
      dailyLimitEnabled: true,
      dailyLimit: 300,
    },
  }

  it('linha não oficial devolve o uso do dia lido do contador da instância', async () => {
    const { quota, usage } = quotaWith(() =>
      Promise.resolve({ sent: 225, extra: 0 }),
    )
    const sut = new GetLineSettings(contextWith([limited]) as never, quota)

    const reading = await sut.execute(input)

    expect(usage).toHaveBeenCalledWith('Z-1', expect.any(Date))
    expect(reading.dailyLimit).toMatchObject({
      sentToday: 225,
      effectiveLimit: 300,
      remainingPercent: 25,
      reached: false,
    })
    expect(mapLineSettingsToView(reading)).toMatchObject({
      settings: { dailyLimitEnabled: true, dailyLimit: 300 },
      dailyLimit: { sentToday: 225 },
    })
  })

  it('linha oficial não lê o contador e a view omite o bloco', async () => {
    const { quota, usage } = quotaWith(() =>
      Promise.resolve({ sent: 1, extra: 0 }),
    )
    const sut = new GetLineSettings(contextWith([oficialItem]) as never, quota)

    const reading = await sut.execute(input)

    expect(usage).not.toHaveBeenCalled()
    expect(reading.dailyLimit).toBeNull()
    expect(mapLineSettingsToView(reading)).not.toHaveProperty('dailyLimit')
  })

  it('falha do contador não derruba a aba: o uso vem nulo', async () => {
    const { quota } = quotaWith(() => Promise.reject(new Error('redis fora')))
    const sut = new GetLineSettings(contextWith([limited]) as never, quota)

    const reading = await sut.execute(input)

    expect(reading.dailyLimit).toBeNull()
    expect(reading.settings.dailyLimit).toBe(300)
    expect(mapLineSettingsToView(reading)).toHaveProperty('dailyLimit', null)
  })
})
