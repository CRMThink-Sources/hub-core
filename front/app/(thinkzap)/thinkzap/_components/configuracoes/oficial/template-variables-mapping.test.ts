import { describe, expect, it } from 'vitest'
import type { CrmField } from '@/app/hooks/use-connector-templates'
import {
  fieldOptions,
  hasTemplateVariables,
  mappingsFromSelection,
  missingFieldVariables,
  selectionFromMappings,
  templateVariablesOf,
} from './template-variables-mapping'

const withBody = (text: string) => ({
  components: [{ type: 'BODY' as const, text }],
})

const fields: CrmField[] = [
  {
    source: 'self',
    id: 'title',
    title: 'Título',
    type: 'string',
    multiple: false,
    custom: false,
  },
  {
    source: 'contact',
    id: 'name',
    title: 'Nome',
    type: 'string',
    multiple: false,
    custom: false,
  },
  {
    source: 'self',
    id: 'ufCrm_1',
    title: 'Apelido',
    type: 'string',
    multiple: false,
    custom: true,
  },
]

describe('templateVariablesOf / hasTemplateVariables', () => {
  it('lê as variáveis do corpo, na ordem e sem repetir', () => {
    expect(
      templateVariablesOf(withBody('Olá {{nome}}, pedido {{2}}, {{nome}}')),
    ).toEqual(['nome', '2'])
  })

  it('template sem variável não oferece a ação', () => {
    expect(hasTemplateVariables(withBody('Bem-vindo à nossa loja'))).toBe(false)
    expect(hasTemplateVariables(withBody('Olá {{1}}'))).toBe(true)
  })

  it('template sem corpo legível não tem variáveis', () => {
    expect(hasTemplateVariables({ components: [] })).toBe(false)
  })
})

describe('fieldOptions', () => {
  const labels = {
    sourceLabel: (s: string) => (s === 'contact' ? 'Contato' : 'Empresa'),
    custom: 'Personalizado',
  }

  it('identifica a origem do vinculado e marca o personalizado', () => {
    expect(fieldOptions(fields, labels)).toEqual([
      { value: 'self:title', label: 'Título' },
      { value: 'contact:name', label: 'Contato › Nome' },
      { value: 'self:ufCrm_1', label: 'Apelido', description: 'Personalizado' },
    ])
  })
})

describe('selection <-> mappings', () => {
  it('ida e volta preservam origem e campo', () => {
    const mappings = {
      '1': { source: 'contact' as const, fieldId: 'name' },
      '2': { source: 'self' as const, fieldId: 'ufCrm_1' },
    }
    const selection = selectionFromMappings(mappings)

    expect(selection).toEqual({ '1': 'contact:name', '2': 'self:ufCrm_1' })
    expect(mappingsFromSelection(['1', '2'], selection)).toEqual(mappings)
  })

  it('variável sem escolha fica fora do que vai à API', () => {
    expect(
      mappingsFromSelection(['1', '2'], { '1': 'self:title', '2': '' }),
    ).toEqual({ '1': { source: 'self', fieldId: 'title' } })
  })

  it('ignora escolha de variável que não está mais no corpo', () => {
    expect(
      mappingsFromSelection(['1'], { '1': 'self:title', '9': 'self:title' }),
    ).toEqual({ '1': { source: 'self', fieldId: 'title' } })
  })

  it('escolha malformada não vira mapeamento', () => {
    expect(mappingsFromSelection(['1'], { '1': 'semorigem' })).toEqual({})
  })
})

describe('missingFieldVariables', () => {
  it('aponta a variável ligada a um campo que a entidade não tem mais', () => {
    expect(
      missingFieldVariables(
        { '1': 'self:title', '2': 'self:apagado', '3': '' },
        fields,
      ),
    ).toEqual(['2'])
  })
})
