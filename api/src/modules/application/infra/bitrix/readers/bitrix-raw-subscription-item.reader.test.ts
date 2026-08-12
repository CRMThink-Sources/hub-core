import { describe, expect, it, vi } from 'vitest'
import { env } from '@/config/env'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixRawSubscriptionItemReader } from './bitrix-raw-subscription-item.reader'

const ITEM_ENTITY_TYPE = env.payments.spa.subscriptionItemEntityType
const PARENT_FIELD = `parentId${env.payments.spa.subscriptionEntityType}`

const makeClient = (item: Record<string, unknown> | undefined) => {
  const getCrmItem = vi.fn(() =>
    Promise.resolve({ result: { item } } as unknown as Awaited<
      ReturnType<BitrixClient['getCrmItem']>
    >),
  )

  return {
    client: { getCrmItem } as unknown as BitrixClient,
    getCrmItem,
  }
}

describe('BitrixRawSubscriptionItemReader', () => {
  it('lê o item recém-criado à mão: provider declarado e nenhuma credencial', async () => {
    const { client, getCrmItem } = makeClient({
      id: 77,
      ufCrm93Provider: 'ZAPI',
      [PARENT_FIELD]: 42,
    })

    const raw = await new BitrixRawSubscriptionItemReader(
      client,
    ).getRawSubscriptionItem('77')

    expect(getCrmItem).toHaveBeenCalledWith(ITEM_ENTITY_TYPE, '77')
    // O shape que o mapper de domínio recusa é o que este leitor devolve sem lançar.
    expect(raw).toEqual({
      id: '77',
      provider: 'ZAPI',
      credentials: {},
      subscriptionId: '42',
    })
  })

  it('normaliza caixa e espaços do provider', async () => {
    const cases: Array<[unknown, string]> = [
      ['zapi', 'ZAPI'],
      [' HubMessage ', 'HUBMESSAGE'],
      ['none', 'NONE'],
    ]

    for (const [raw, expected] of cases) {
      const { client } = makeClient({
        id: 1,
        ufCrm93Provider: raw,
        [PARENT_FIELD]: 42,
      })

      const item = await new BitrixRawSubscriptionItemReader(
        client,
      ).getRawSubscriptionItem('1')

      expect(item?.provider).toBe(expected)
    }
  })

  it('provider ausente, vazio ou não-texto sai como string vazia, nunca como NONE', async () => {
    for (const raw of [undefined, null, '', '   ', {}]) {
      const { client } = makeClient({
        id: 1,
        ufCrm93Provider: raw,
        [PARENT_FIELD]: 42,
      })

      const item = await new BitrixRawSubscriptionItemReader(
        client,
      ).getRawSubscriptionItem('1')

      expect(item?.provider).toBe('')
    }
  })

  it('colapsa credencial vazia em ausência de chave', async () => {
    const { client } = makeClient({
      id: 1,
      ufCrm93Provider: 'ZAPI',
      ufCrm93ZApiInstanceId: 'inst-1',
      ufCrm93ZApiInstanceToken: 'tok-1',
      ufCrm93HubChanelId: '',
      ufCrm93HubWabaId: null,
      [PARENT_FIELD]: 42,
    })

    const item = await new BitrixRawSubscriptionItemReader(
      client,
    ).getRawSubscriptionItem('1')

    expect(item?.credentials).toEqual({
      zApiInstanceId: 'inst-1',
      zApiInstanceToken: 'tok-1',
    })
  })

  it('devolve credencial de provider cruzado sem julgar — a decisão é do caso de uso', async () => {
    const { client } = makeClient({
      id: 1,
      ufCrm93Provider: 'HUBMESSAGE',
      ufCrm93ZApiInstanceId: 'inst-1',
      ufCrm93ZApiInstanceToken: 'tok-1',
      [PARENT_FIELD]: 42,
    })

    const item = await new BitrixRawSubscriptionItemReader(
      client,
    ).getRawSubscriptionItem('1')

    expect(item).toEqual({
      id: '1',
      provider: 'HUBMESSAGE',
      credentials: { zApiInstanceId: 'inst-1', zApiInstanceToken: 'tok-1' },
      subscriptionId: '42',
    })
  })

  it('parent ausente, zero ou vazio sai como null', async () => {
    for (const parent of [undefined, 0, '0', '', null]) {
      const { client } = makeClient({
        id: 1,
        ufCrm93Provider: 'ZAPI',
        [PARENT_FIELD]: parent,
      })

      const item = await new BitrixRawSubscriptionItemReader(
        client,
      ).getRawSubscriptionItem('1')

      expect(item?.subscriptionId).toBeNull()
    }
  })

  it('item inexistente devolve null', async () => {
    const { client } = makeClient(undefined)

    const item = await new BitrixRawSubscriptionItemReader(
      client,
    ).getRawSubscriptionItem('999')

    expect(item).toBeNull()
  })

  it('cai para o id pedido quando o item não traz id', async () => {
    const { client } = makeClient({
      ufCrm93Provider: 'ZAPI',
      [PARENT_FIELD]: 42,
    })

    const item = await new BitrixRawSubscriptionItemReader(
      client,
    ).getRawSubscriptionItem('55')

    expect(item?.id).toBe('55')
  })

  it('falha do Bitrix sobe: o chamador distingue "sem item" de "CRM fora do ar"', async () => {
    const getCrmItem = vi.fn(() => Promise.reject(new Error('boom')))
    const client = { getCrmItem } as unknown as BitrixClient

    await expect(
      new BitrixRawSubscriptionItemReader(client).getRawSubscriptionItem('1'),
    ).rejects.toThrow('boom')
  })
})
