import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ListCrmEntityTypesUseCase } from './list-crm-entity-types'

function makeSut(callMethod: Pick<BitrixClient, 'callMethod'>['callMethod']) {
  return new ListCrmEntityTypesUseCase({ callMethod })
}

describe('ListCrmEntityTypesUseCase', () => {
  it('lista as quatro entidades padrão e as SPAs com título', async () => {
    const callMethod = vi.fn().mockResolvedValue({
      result: { types: [{ entityTypeId: 1060, title: 'Propostas' }] },
    })

    const types = await makeSut(callMethod).execute()

    expect(types.map(t => t.entityTypeId)).toEqual([1, 2, 3, 4, 1060])
    expect(types.at(-1)).toEqual({
      entityTypeId: 1060,
      title: 'Propostas',
      kind: 'spa',
    })
  })

  it('pagina enquanto a página vem cheia', async () => {
    const page = Array.from({ length: 50 }, (_, i) => ({
      entityTypeId: 1000 + i,
      title: `SPA ${i}`,
    }))
    const callMethod = vi
      .fn()
      .mockResolvedValueOnce({ result: { types: page } })
      .mockResolvedValueOnce({ result: { types: [] } })

    const types = await makeSut(callMethod).execute()

    expect(callMethod).toHaveBeenCalledTimes(2)
    expect(callMethod).toHaveBeenLastCalledWith('crm.type.list', { start: 50 })
    expect(types).toHaveLength(54)
  })

  it('falha ao listar SPAs mantém as entidades padrão', async () => {
    const callMethod = vi.fn().mockRejectedValue(new Error('Failed'))

    const types = await makeSut(callMethod).execute()

    expect(types.map(t => t.entityTypeId)).toEqual([1, 2, 3, 4])
  })
})
