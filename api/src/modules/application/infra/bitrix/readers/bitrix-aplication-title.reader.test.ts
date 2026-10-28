import { describe, expect, it, vi } from 'vitest'
import { BitrixAplicationTitleReader } from './bitrix-aplication-title.reader'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { env } from '@/config/env'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const makeBitrix = (
  listCrmItems: (
    entityTypeId: number,
    filter: Record<string, unknown>,
    options?: { select?: string[] },
  ) => Promise<unknown>,
) =>
  ({ listCrmItems: vi.fn(listCrmItems) }) as unknown as BitrixClient & {
    listCrmItems: ReturnType<typeof vi.fn>
  }

const respondingWith = (items: unknown[]) =>
  makeBitrix(() => Promise.resolve({ result: { items } }))

describe('BitrixAplicationTitleReader', () => {
  it('devolve o título indexado pelo id, coagido para string', async () => {
    const bitrix = respondingWith([
      { id: 512, title: 'ThinkersZap — Acme' },
      { id: '900', title: 'GPT Maker — Acme' },
    ])

    const titles = await new BitrixAplicationTitleReader(
      bitrix,
    ).getTitlesBySpaIds(['512', '900'])

    expect(titles.get('512')).toBe('ThinkersZap — Acme')
    expect(titles.get('900')).toBe('GPT Maker — Acme')
  })

  it('pede só id e title, na SPA de aplicação, filtrando pelos ids em conjunto', async () => {
    const bitrix = respondingWith([])

    await new BitrixAplicationTitleReader(bitrix).getTitlesBySpaIds([
      '512',
      '900',
    ])

    expect(bitrix.listCrmItems).toHaveBeenCalledWith(
      env.payments.spa.aplicationEntityType,
      { '@id': ['512', '900'] },
      { select: ['id', 'title'] },
    )
  })

  it('não chama o Bitrix para lista vazia', async () => {
    const bitrix = respondingWith([])

    const titles = await new BitrixAplicationTitleReader(
      bitrix,
    ).getTitlesBySpaIds([])

    expect(titles.size).toBe(0)
    expect(bitrix.listCrmItems).not.toHaveBeenCalled()
  })

  it('fatia em lotes de 50, porque a listagem do Bitrix não pagina', async () => {
    const ids = Array.from({ length: 120 }, (_, index) => String(index + 1))
    const bitrix = makeBitrix((_entityTypeId, filter) => {
      const batch = (filter['@id'] as string[]).map(id => ({
        id,
        title: `App ${id}`,
      }))
      return Promise.resolve({ result: { items: batch } })
    })

    const titles = await new BitrixAplicationTitleReader(
      bitrix,
    ).getTitlesBySpaIds(ids)

    expect(bitrix.listCrmItems).toHaveBeenCalledTimes(3)
    expect(titles.size).toBe(120)
    expect(titles.get('120')).toBe('App 120')
  })

  it('deduplica ids repetidos antes de montar o lote', async () => {
    const bitrix = respondingWith([{ id: '512', title: 'ThinkersZap' }])

    await new BitrixAplicationTitleReader(bitrix).getTitlesBySpaIds([
      '512',
      '512',
    ])

    expect(bitrix.listCrmItems).toHaveBeenCalledWith(
      env.payments.spa.aplicationEntityType,
      { '@id': ['512'] },
      { select: ['id', 'title'] },
    )
  })

  it('devolve Map parcial quando um lote falha, sem propagar o erro', async () => {
    let call = 0
    const ids = Array.from({ length: 60 }, (_, index) => String(index + 1))
    const bitrix = makeBitrix((_entityTypeId, filter) => {
      call += 1
      if (call === 1) return Promise.reject(new BitrixError('bitrix down'))

      const batch = (filter['@id'] as string[]).map(id => ({
        id,
        title: `App ${id}`,
      }))
      return Promise.resolve({ result: { items: batch } })
    })

    const titles = await new BitrixAplicationTitleReader(
      bitrix,
    ).getTitlesBySpaIds(ids)

    // O primeiro lote (50 ids) caiu; o segundo (10) entrou.
    expect(titles.size).toBe(10)
    expect(titles.has('1')).toBe(false)
    expect(titles.get('60')).toBe('App 60')
  })

  it('ignora item sem título, com título vazio ou só espaços', async () => {
    const bitrix = respondingWith([
      { id: '1' },
      { id: '2', title: '' },
      { id: '3', title: '   ' },
      { id: '4', title: null },
      { id: '5', title: '  ThinkersZap  ' },
    ])

    const titles = await new BitrixAplicationTitleReader(
      bitrix,
    ).getTitlesBySpaIds(['1', '2', '3', '4', '5'])

    expect(titles.size).toBe(1)
    expect(titles.get('5')).toBe('ThinkersZap')
  })

  it('trata resposta sem items como lote sem títulos', async () => {
    const bitrix = makeBitrix(() => Promise.resolve({ result: {} }))

    const titles = await new BitrixAplicationTitleReader(
      bitrix,
    ).getTitlesBySpaIds(['512'])

    expect(titles.size).toBe(0)
  })

  describe('getMirrorsBySpaIds', () => {
    it('separa existentes, títulos e ids de lote com falha', async () => {
      let call = 0
      const ids = Array.from({ length: 60 }, (_, index) => String(index + 1))
      const bitrix = makeBitrix((_entityTypeId, filter) => {
        call += 1
        if (call === 1) return Promise.reject(new BitrixError('bitrix down'))

        // Segundo lote (51..60): 55 sem título, 60 apagado no CRM.
        const batch = (filter['@id'] as string[])
          .filter(id => id !== '60')
          .map(id => ({ id, title: id === '55' ? '' : `App ${id}` }))
        return Promise.resolve({ result: { items: batch } })
      })

      const read = await new BitrixAplicationTitleReader(
        bitrix,
      ).getMirrorsBySpaIds(ids)

      expect(read.unverified.size).toBe(50)
      expect(read.unverified.has('1')).toBe(true)
      expect(read.existing.has('55')).toBe(true)
      expect(read.titles.has('55')).toBe(false)
      expect(read.existing.has('60')).toBe(false)
      expect(read.unverified.has('60')).toBe(false)
      expect(read.titles.get('51')).toBe('App 51')
    })

    it('lista vazia não chama o Bitrix', async () => {
      const bitrix = respondingWith([])

      const read = await new BitrixAplicationTitleReader(
        bitrix,
      ).getMirrorsBySpaIds([])

      expect(read.existing.size).toBe(0)
      expect(bitrix.listCrmItems).not.toHaveBeenCalled()
    })
  })
})
