import { describe, expect, it, vi } from 'vitest'
import { BitrixActiveResourceUsageReader } from './bitrix-active-resource-usage.reader'

describe('BitrixActiveResourceUsageReader', () => {
  it('lista os outros itens ativos com a mesma instância Z-API, sem o próprio e sem excluídos', async () => {
    const listCrmItems = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          items: [
            { id: 9001, ufCrm93DeletedAt: '' },
            { id: 9002, ufCrm93DeletedAt: null },
            { id: 9003, ufCrm93DeletedAt: '2026-11-01T10:00:00+03:00' },
          ],
        },
        next: 50,
      })
      .mockResolvedValueOnce({ result: { items: [{ id: '9004' }] } })
      .mockResolvedValueOnce({ result: { items: [] } })

    const ids = await new BitrixActiveResourceUsageReader({
      listCrmItems,
    }).listOtherActiveItemIds(
      { provider: 'ZAPI', instanceId: 'inst-1' },
      '9001',
    )

    expect(ids).toEqual(['9002', '9004'])
    expect(listCrmItems).toHaveBeenCalledWith(
      1146,
      { '=ufCrm93ZApiInstanceId': 'inst-1', ufCrm93Status: '13625' },
      { select: ['id', 'parentId1142', 'ufCrm93DeletedAt'] },
    )
    expect(listCrmItems.mock.calls[1]?.[2]).toMatchObject({ start: 50 })
  })

  /** Duas linhas de contratos encerrados não podem proteger uma à outra para sempre. */
  it('não conta linha ativa cuja assinatura pai está cancelada', async () => {
    const listCrmItems = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          items: [
            { id: 9002, parentId1142: 501 },
            { id: 9003, parentId1142: 502 },
          ],
        },
      })
      .mockResolvedValueOnce({ result: { items: [{ id: 502 }] } })

    const ids = await new BitrixActiveResourceUsageReader({
      listCrmItems,
    }).listOtherActiveItemIds(
      { provider: 'ZAPI', instanceId: 'inst-1' },
      '9001',
    )

    expect(ids).toEqual(['9002'])
    expect(listCrmItems.mock.calls[1]?.[0]).toBe(1142)
    expect(listCrmItems.mock.calls[1]?.[1]).toEqual({
      '@id': ['501', '502'],
      ufCrm91Status: '13623',
    })
  })

  it('falha ao ler os pais sobe (falha fechada: não desassina)', async () => {
    const listCrmItems = vi
      .fn()
      .mockResolvedValueOnce({
        result: { items: [{ id: 9002, parentId1142: 501 }] },
      })
      .mockRejectedValueOnce(new Error('bitrix fora'))

    await expect(
      new BitrixActiveResourceUsageReader({
        listCrmItems,
      }).listOtherActiveItemIds(
        { provider: 'ZAPI', instanceId: 'inst-1' },
        '9001',
      ),
    ).rejects.toThrow('bitrix fora')
  })

  it('busca o canal da HubMessage pelo campo do canal', async () => {
    const listCrmItems = vi.fn().mockResolvedValue({ result: { items: [] } })

    await new BitrixActiveResourceUsageReader({
      listCrmItems,
    }).listOtherActiveItemIds(
      { provider: 'HUBMESSAGE', instanceId: 'ch-1' },
      '9001',
    )

    expect(listCrmItems.mock.calls[0]?.[1]).toEqual({
      '=ufCrm93HubChanelId': 'ch-1',
      ufCrm93Status: '13625',
    })
  })
})
