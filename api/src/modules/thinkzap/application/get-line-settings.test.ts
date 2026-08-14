import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GetLineSettings } from './get-line-settings'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

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
