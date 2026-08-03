import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { describe, expect, it, vi } from 'vitest'
import { ListGroupsService } from './list-groups.service'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'

const zapiItem: SubscriptionItem = {
  id: 'i1',
  name: 'Linha i1',
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

const input = {
  subscriptionItemId: 'i1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
}

function conversation(index: number, isGroup: boolean) {
  return { isGroup, phone: `p-${index}`, name: `Conversa ${index}` }
}

function makeSut(conversations: ReturnType<typeof conversation>[]) {
  const execute = vi.fn().mockResolvedValue({
    customer: { id: 'domain-1', name: 'acme.bitrix24.com.br' },
    aplication: { id: 'installed-1', spaId: '42' },
    subscriptions: [{ id: 'sub-1', items: [zapiItem] }],
  })

  const zApiClient = {
    getInstance: vi.fn().mockResolvedValue({ connected: true }),
    getPhoneData: vi.fn().mockResolvedValue({ phone: '5511999999999' }),
    listGroups: vi.fn().mockResolvedValue(conversations),
  }

  return {
    zApiClient,
    service: new ListGroupsService({ execute } as never, zApiClient as never),
  }
}

describe('ListGroupsService', () => {
  it('filtra conversas que não são grupo', async () => {
    const sut = makeSut([
      conversation(1, true),
      conversation(2, false),
      conversation(3, true),
    ])

    const result = await sut.service.execute(input)

    expect(result.items).toHaveLength(2)
    expect(result.items.every(g => g.isGroup)).toBe(true)
  })

  /**
   * A regressão: o front deduzia "tem próxima" de `items.length >= pageSize`.
   * A Z-API pagina **conversas**, e o filtro de grupos roda depois, então uma
   * página cheia pode devolver poucos grupos — e o botão Próxima travava sem
   * disparar request nenhuma.
   */
  it('reporta próxima página pelo tamanho da página crua, não pelo filtrado', async () => {
    const conversations = Array.from({ length: 20 }, (_, i) =>
      conversation(i, i < 3),
    )
    const sut = makeSut(conversations)

    const result = await sut.service.execute({ ...input, pageSize: 20 })

    expect(result.items).toHaveLength(3)
    expect(result.hasNextPage).toBe(true)
  })

  it('não reporta próxima página quando a Z-API devolve página incompleta', async () => {
    const sut = makeSut([conversation(1, true), conversation(2, true)])

    const result = await sut.service.execute({ ...input, pageSize: 20 })

    expect(result.hasNextPage).toBe(false)
  })

  it('repassa página e tamanho pedidos para a Z-API', async () => {
    const sut = makeSut([])

    await sut.service.execute({ ...input, page: 3, pageSize: 50 })

    expect(sut.zApiClient.listGroups).toHaveBeenCalledWith(
      'Z-1',
      'TOKEN-SECRETO',
      3,
      50,
    )
  })
})
