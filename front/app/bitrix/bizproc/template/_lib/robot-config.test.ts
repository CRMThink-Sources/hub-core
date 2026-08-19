import { describe, expect, it } from 'vitest'
import {
  buildRobotProperties,
  fromStoredValue,
  parseStoredProperties,
  rebuildValues,
  toStoredValue,
  validateConfig,
  type RobotConfigState,
} from './robot-config'
import { toDocumentFields } from './placement-bridge'

const base: RobotConfigState = {
  connector: 'item_1',
  destination: { mode: 'literal', value: '5511999999999' },
  sendToAllRelatedContacts: false,
  template: {
    name: 'order_update',
    language: 'pt_BR',
    body: 'Olá {{nome}}, pedido {{numero}} — obrigado, {{nome}}.',
  },
  values: {
    nome: { mode: 'document', value: 'TITLE' },
    numero: { mode: 'literal', value: '42' },
  },
}

describe('toStoredValue / fromStoredValue', () => {
  it('grava campo do documento como expressão do Bitrix', () => {
    expect(toStoredValue({ mode: 'document', value: 'UF_CRM_1' })).toBe(
      '{{=Document:UF_CRM_1}}',
    )
  })

  it('grava literal sem transformação', () => {
    expect(toStoredValue({ mode: 'literal', value: '5511999' })).toBe('5511999')
  })

  it('campo do documento vazio não vira expressão quebrada', () => {
    expect(toStoredValue({ mode: 'document', value: '' })).toBe('')
  })

  // O modo não é gravado: ele é derivado da forma do valor quando a tela reabre.
  it('reconhece a expressão de volta ao reabrir', () => {
    expect(fromStoredValue('{{=Document:PHONE}}')).toEqual({
      mode: 'document',
      value: 'PHONE',
    })
  })

  it('trata texto comum como literal', () => {
    expect(fromStoredValue('Olá')).toEqual({ mode: 'literal', value: 'Olá' })
  })

  it('trata ausência como literal vazio', () => {
    expect(fromStoredValue(undefined)).toEqual({ mode: 'literal', value: '' })
  })
})

describe('buildRobotProperties', () => {
  it('grava todas as propriedades que o webhook lê', () => {
    expect(buildRobotProperties(base)).toEqual({
      connector: 'item_1',
      destination: '5511999999999',
      sendToAllRelatedContacts: 'N',
      templateName: 'order_update',
      templateLanguage: 'pt_BR',
      templateBody: 'Olá {{nome}}, pedido {{numero}} — obrigado, {{nome}}.',
      templateParameters: ['{{=Document:TITLE}}', '42'],
    })
  })

  // Ordem de aparição das variáveis distintas: é ela que liga cada valor ao seu
  // placeholder do outro lado.
  it('mantém a ordem posicional das variáveis distintas', () => {
    const { templateParameters } = buildRobotProperties({
      ...base,
      template: {
        name: 't',
        language: 'pt_BR',
        body: '{{segundo}} vem depois de {{primeiro}}? Não: {{segundo}} é o primeiro.',
      },
      values: {
        primeiro: { mode: 'literal', value: 'A' },
        segundo: { mode: 'literal', value: 'B' },
      },
    })

    expect(templateParameters).toEqual(['B', 'A'])
  })

  it('grava a alternância ligada como Y', () => {
    expect(
      buildRobotProperties({ ...base, sendToAllRelatedContacts: true })
        .sendToAllRelatedContacts,
    ).toBe('Y')
  })

  it('grava vazio quando não há template escolhido', () => {
    const properties = buildRobotProperties({ ...base, template: null })

    expect(properties.templateName).toBe('')
    expect(properties.templateBody).toBe('')
    expect(properties.templateParameters).toEqual([])
  })
})

describe('parseStoredProperties', () => {
  it('recompõe o estado a partir do que estava gravado', () => {
    const stored = buildRobotProperties(base)

    expect(parseStoredProperties(stored)).toEqual(base)
  })

  it('aceita propriedade múltipla como objeto indexado', () => {
    const parsed = parseStoredProperties({
      connector: 'item_1',
      templateName: 't',
      templateLanguage: 'pt_BR',
      templateBody: '{{a}} e {{b}}',
      templateParameters: { '1': 'B', '0': 'A' },
    })

    expect(parsed.values).toEqual({
      a: { mode: 'literal', value: 'A' },
      b: { mode: 'literal', value: 'B' },
    })
  })

  it('sem template gravado, não inventa campos de variável', () => {
    expect(parseStoredProperties({}).values).toEqual({})
    expect(parseStoredProperties({}).template).toBeNull()
  })

  it('lê a alternância nas formas que o Bitrix usa', () => {
    expect(
      parseStoredProperties({ sendToAllRelatedContacts: 'Y' })
        .sendToAllRelatedContacts,
    ).toBe(true)
    expect(
      parseStoredProperties({ sendToAllRelatedContacts: 'N' })
        .sendToAllRelatedContacts,
    ).toBe(false)
  })
})

describe('rebuildValues', () => {
  it('preserva o valor de variável de mesmo nome ao trocar de template', () => {
    const rebuilt = rebuildValues('Oi {{nome}}, código {{codigo}}', {
      nome: { mode: 'literal', value: 'Ana' },
      antigo: { mode: 'literal', value: 'some' },
    })

    expect(rebuilt).toEqual({
      nome: { mode: 'literal', value: 'Ana' },
      codigo: { mode: 'literal', value: '' },
    })
  })

  it('template sem variável limpa os campos', () => {
    expect(
      rebuildValues('Sem variáveis', { a: { mode: 'literal', value: 'x' } }),
    ).toEqual({})
  })
})

describe('validateConfig', () => {
  it('aceita a configuração completa', () => {
    expect(validateConfig(base)).toBeNull()
  })

  it('exige a linha', () => {
    expect(validateConfig({ ...base, connector: '' })).toMatch(/linha/i)
  })

  it('exige o template', () => {
    expect(validateConfig({ ...base, template: null })).toMatch(/template/i)
  })

  // Destino vazio com a alternância desligada nunca envia — e a recusa aconteceria
  // na timeline da entidade, longe de quem configurou.
  it('exige destino quando a alternância está desligada', () => {
    expect(
      validateConfig({
        ...base,
        destination: { mode: 'literal', value: '' },
      }),
    ).toMatch(/destino/i)
  })

  it('dispensa o destino quando a alternância está ligada', () => {
    expect(
      validateConfig({
        ...base,
        destination: { mode: 'literal', value: '' },
        sendToAllRelatedContacts: true,
      }),
    ).toBeNull()
  })
})

describe('toDocumentFields', () => {
  it('converte o mapa do bizproc.document.fields, ordenado por título', () => {
    expect(
      toDocumentFields({
        TITLE: { Name: 'Título', Type: 'string' },
        PHONE: { Name: 'Telefone', Type: 'string', Multiple: 'Y' },
      }),
    ).toEqual([
      { id: 'PHONE', title: 'Telefone', type: 'string', multiple: true },
      { id: 'TITLE', title: 'Título', type: 'string', multiple: false },
    ])
  })

  it('cai no id quando o campo não tem nome', () => {
    expect(toDocumentFields({ UF_CRM_1: {} })[0]).toEqual({
      id: 'UF_CRM_1',
      title: 'UF_CRM_1',
      type: 'string',
      multiple: false,
    })
  })

  it('trata resposta inesperada como lista vazia', () => {
    expect(toDocumentFields(null)).toEqual([])
    expect(toDocumentFields('erro')).toEqual([])
  })
})
