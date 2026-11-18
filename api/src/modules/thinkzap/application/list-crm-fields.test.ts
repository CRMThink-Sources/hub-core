import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ListCrmFieldsUseCase } from './list-crm-fields'

type FieldsReader = Pick<BitrixClient, 'getCrmItemFields'>

function fieldsOf(entityTypeId: number) {
  const byType: Record<number, Record<string, object>> = {
    2: {
      title: { type: 'string', title: 'Título' },
      ufCrm_1: { type: 'string', title: 'Apelido' },
      fileField: { type: 'file', title: 'Anexo' },
    },
    3: { name: { type: 'string', title: 'Nome' } },
    4: { title: { type: 'string', title: 'Nome da empresa' } },
  }
  return { result: { fields: byType[entityTypeId] ?? {} } }
}

function makeSut() {
  const getCrmItemFields = vi
    .fn<FieldsReader['getCrmItemFields']>()
    .mockImplementation(id => Promise.resolve(fieldsOf(id) as never))
  return {
    sut: new ListCrmFieldsUseCase({ getCrmItemFields }),
    getCrmItemFields,
  }
}

describe('ListCrmFieldsUseCase', () => {
  it('Negócio lista os próprios campos e os de Contato e Empresa', async () => {
    const { sut, getCrmItemFields } = makeSut()

    const fields = await sut.execute({ entityTypeId: 2 })

    expect(getCrmItemFields.mock.calls.map(c => c[0]).sort()).toEqual([2, 3, 4])
    expect(fields.map(f => `${f.source}:${f.id}`)).toEqual([
      'self:title',
      'self:ufCrm_1',
      'contact:name',
      'company:title',
    ])
  })

  it('omite campo de tipo sem texto útil e põe o personalizado depois', async () => {
    const { sut } = makeSut()

    const self = (await sut.execute({ entityTypeId: 2 })).filter(
      f => f.source === 'self',
    )

    expect(self.map(f => f.id)).toEqual(['title', 'ufCrm_1'])
    expect(self[1]?.custom).toBe(true)
  })

  it('Empresa lista só os próprios campos', async () => {
    const { sut, getCrmItemFields } = makeSut()

    const fields = await sut.execute({ entityTypeId: 4 })

    expect(getCrmItemFields).toHaveBeenCalledTimes(1)
    expect(fields.every(f => f.source === 'self')).toBe(true)
  })

  it('falha do Bitrix propaga', async () => {
    const getCrmItemFields = vi
      .fn<FieldsReader['getCrmItemFields']>()
      .mockRejectedValue(new Error('Failed'))
    const sut = new ListCrmFieldsUseCase({ getCrmItemFields })

    await expect(sut.execute({ entityTypeId: 2 })).rejects.toThrow('Failed')
  })
})
