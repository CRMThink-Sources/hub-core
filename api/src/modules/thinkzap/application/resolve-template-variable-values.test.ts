import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { TemplateVariableMappingsRepository } from '@/modules/thinkzap/domain/ports/template-variable-mappings-repository.port'
import type { VariableMappings } from '@/modules/thinkzap/domain/template-variable-mapping'
import { ResolveTemplateVariableValuesUseCase } from './resolve-template-variable-values'

type Reader = Pick<BitrixClient, 'getCrmItem' | 'getCrmItemFields'>

const input = {
  domainId: 'domain_1',
  subscriptionItemId: 'item_1',
  name: 'pedido',
  language: 'pt_BR',
  entityTypeId: 2,
  entityId: '77',
}

const records: Record<string, Record<string, unknown>> = {
  '2:77': {
    title: 'Proposta ACME',
    stageLabel: '10',
    contactId: 5,
    contactIds: [5, 6],
    companyId: 9,
  },
  '3:5': { name: 'Maria', phone: [{ id: '1', value: '+5511999990000' }] },
  '4:9': { title: 'ACME Ltda', empty: '' },
}

function makeSut(mappings: VariableMappings | null) {
  const getCrmItem = vi
    .fn<Reader['getCrmItem']>()
    .mockImplementation((typeId, id) => {
      const item = records[`${typeId}:${id}`]
      return item
        ? Promise.resolve({ result: { item } })
        : Promise.reject(new Error('not found'))
    })
  const getCrmItemFields = vi
    .fn<Reader['getCrmItemFields']>()
    .mockResolvedValue({
      result: {
        fields: {
          stageLabel: {
            type: 'enumeration',
            items: [{ ID: '10', VALUE: 'Em negociação' }],
          },
        },
      },
    })
  const repository: TemplateVariableMappingsRepository = {
    find: vi.fn().mockResolvedValue(mappings),
    upsert: vi.fn(),
    delete: vi.fn(),
  }
  return {
    sut: new ResolveTemplateVariableValuesUseCase(
      { getCrmItem, getCrmItemFields },
      repository,
    ),
    getCrmItem,
    getCrmItemFields,
    repository,
  }
}

describe('ResolveTemplateVariableValuesUseCase', () => {
  it('preenche com campos do Negócio e do Contato vinculado', async () => {
    const { sut } = makeSut({
      '1': { source: 'contact', fieldId: 'name' },
      '2': { source: 'self', fieldId: 'title' },
      '3': { source: 'company', fieldId: 'title' },
    })

    expect(await sut.execute(input)).toEqual({
      values: { '1': 'Maria', '2': 'Proposta ACME', '3': 'ACME Ltda' },
    })
  })

  it('usa o contato principal, e o primeiro valor do telefone', async () => {
    const { sut, getCrmItem } = makeSut({
      '1': { source: 'contact', fieldId: 'phone' },
    })

    const { values } = await sut.execute(input)

    expect(values).toEqual({ '1': '+5511999990000' })
    expect(getCrmItem).toHaveBeenCalledWith(3, '5')
    expect(getCrmItem).not.toHaveBeenCalledWith(3, '6')
  })

  it('campo de lista traz o rótulo, lendo a descrição dos campos', async () => {
    const { sut, getCrmItemFields } = makeSut({
      '1': { source: 'self', fieldId: 'stageLabel' },
    })

    expect(await sut.execute(input)).toEqual({
      values: { '1': 'Em negociação' },
    })
    expect(getCrmItemFields).toHaveBeenCalledWith(2)
  })

  it('só lê as fontes que o mapeamento usa', async () => {
    const { sut, getCrmItem, getCrmItemFields } = makeSut({
      '1': { source: 'self', fieldId: 'title' },
    })

    await sut.execute(input)

    expect(getCrmItem).toHaveBeenCalledTimes(1)
    expect(getCrmItemFields).not.toHaveBeenCalled()
  })

  it('sem mapeamento não chama o Bitrix', async () => {
    const { sut, getCrmItem } = makeSut(null)

    expect(await sut.execute(input)).toEqual({ values: {} })
    expect(getCrmItem).not.toHaveBeenCalled()
  })

  it('campo vazio e vínculo inexistente deixam a variável de fora', async () => {
    const { sut } = makeSut({
      '1': { source: 'company', fieldId: 'empty' },
      '2': { source: 'self', fieldId: 'inexistente' },
    })

    expect(await sut.execute({ ...input, entityId: '77' })).toEqual({
      values: {},
    })
  })

  it('contato sem vínculo no registro não derruba as outras variáveis', async () => {
    records['2:78'] = { title: 'Sem contato' }
    const { sut } = makeSut({
      '1': { source: 'contact', fieldId: 'name' },
      '2': { source: 'self', fieldId: 'title' },
    })

    expect(await sut.execute({ ...input, entityId: '78' })).toEqual({
      values: { '2': 'Sem contato' },
    })
  })

  it('falha ao ler o registro devolve vazio, sem lançar', async () => {
    const { sut } = makeSut({ '1': { source: 'self', fieldId: 'title' } })

    expect(await sut.execute({ ...input, entityId: '404' })).toEqual({
      values: {},
    })
  })

  it('falha ao ler só o Contato mantém as variáveis da entidade', async () => {
    records['2:79'] = { title: 'Só negócio', contactId: 404 }
    const { sut } = makeSut({
      '1': { source: 'contact', fieldId: 'name' },
      '2': { source: 'self', fieldId: 'title' },
    })

    expect(await sut.execute({ ...input, entityId: '79' })).toEqual({
      values: { '2': 'Só negócio' },
    })
  })

  it('sem a descrição dos campos, valor ambíguo é omitido', async () => {
    const { sut, getCrmItemFields } = makeSut({
      '1': { source: 'self', fieldId: 'stageLabel' },
    })
    getCrmItemFields.mockRejectedValue(new Error('Failed'))

    expect(await sut.execute(input)).toEqual({ values: {} })
  })
})
