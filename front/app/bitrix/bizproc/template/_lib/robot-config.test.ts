import { describe, expect, it } from 'vitest'
import {
  expressionLabel,
  buildRobotProperties,
  fromStoredValue,
  parseStoredProperties,
  rebuildButtonValues,
  rebuildValues,
  toStoredValue,
  validateConfig,
  type RobotConfigState,
} from './robot-config'

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
  buttonValues: [],
  headerImage: { mode: 'literal', value: '' },
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
      templateButtonParameters: [],
      templateHeaderImageUrl: '',
    })
  })

  it('grava a imagem do cabeçalho como campo do documento', () => {
    expect(
      buildRobotProperties({
        ...base,
        headerImage: { mode: 'document', value: 'UF_CRM_IMAGEM' },
      }).templateHeaderImageUrl,
    ).toBe('{{=Document:UF_CRM_IMAGEM}}')
  })

  it('grava os valores dos botões dinâmicos na ordem, com campo do documento', () => {
    expect(
      buildRobotProperties({
        ...base,
        buttonValues: [
          { mode: 'document', value: 'UF_CRM_CUPOM' },
          { mode: 'literal', value: 'PED-1' },
        ],
      }).templateButtonParameters,
    ).toEqual(['{{=Document:UF_CRM_CUPOM}}', 'PED-1'])
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

  it('recompõe a imagem do cabeçalho gravada', () => {
    const headerImage = {
      mode: 'literal' as const,
      value: 'https://loja.com/a.png',
    }
    const stored = buildRobotProperties({ ...base, headerImage })

    expect(parseStoredProperties(stored).headerImage).toEqual(headerImage)
  })

  it('robô salvo antes da imagem abre com o campo vazio', () => {
    const { templateHeaderImageUrl: _, ...stored } = buildRobotProperties(base)

    expect(parseStoredProperties(stored).headerImage).toEqual({
      mode: 'literal',
      value: '',
    })
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

  it('recompõe os valores dos botões gravados', () => {
    const withButtons = {
      ...base,
      buttonValues: [{ mode: 'document' as const, value: 'UF_CRM_CUPOM' }],
    }

    expect(
      parseStoredProperties(buildRobotProperties(withButtons)).buttonValues,
    ).toEqual(withButtons.buttonValues)
  })

  it('robô salvo antes dos botões abre sem valores de botão', () => {
    expect(parseStoredProperties({}).buttonValues).toEqual([])
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

describe('rebuildButtonValues', () => {
  it('um campo vazio por botão dinâmico do template escolhido', () => {
    expect(
      rebuildButtonValues([
        { index: 0, type: 'QUICK_REPLY', text: 'Sim', dynamic: false },
        { index: 1, type: 'COPY_CODE', text: '', dynamic: true },
      ]),
    ).toEqual([{ mode: 'literal', value: '' }])
    expect(rebuildButtonValues(undefined)).toEqual([])
  })
})

describe('validateConfig', () => {
  it('aceita a configuração completa', () => {
    expect(validateConfig(base)).toBeNull()
  })

  it('impede salvar com botão dinâmico vazio', () => {
    expect(
      validateConfig(
        { ...base, buttonValues: [{ mode: 'literal', value: ' ' }] },
        1,
      ),
    ).toBe('Preencha o valor de todos os botões do template.')
    expect(
      validateConfig(
        { ...base, buttonValues: [{ mode: 'literal', value: 'X' }] },
        1,
      ),
    ).toBeNull()
  })

  it('sem catálogo carregado, não confere os botões', () => {
    expect(validateConfig(base)).toBeNull()
  })

  it('impede salvar template com imagem sem a URL', () => {
    expect(validateConfig(base, 0, true)).toContain(
      'Informe a imagem do cabeçalho',
    )
  })

  it('impede salvar imagem fixa sem https', () => {
    expect(
      validateConfig(
        {
          ...base,
          headerImage: { mode: 'literal', value: 'http://loja.com/a.png' },
        },
        0,
        true,
      ),
    ).toBe('A imagem do cabeçalho precisa ser uma URL https.')
  })

  it('aceita imagem fixa https ou campo do documento', () => {
    expect(
      validateConfig(
        {
          ...base,
          headerImage: { mode: 'literal', value: 'https://loja.com/a.png' },
        },
        0,
        true,
      ),
    ).toBeNull()
    expect(
      validateConfig(
        { ...base, headerImage: { mode: 'document', value: 'UF_CRM_IMG' } },
        0,
        true,
      ),
    ).toBeNull()
  })

  it('template sem imagem não exige o campo', () => {
    expect(validateConfig(base, 0, false)).toBeNull()
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

/**
 * O que volta em `current_values` não é byte a byte o que gravamos: o designer de
 * workflow usa uma chave só, e o portal pode acrescentar espaço ou modificador. Cada
 * forma não reconhecida reabria a variável em "Texto" com a expressão crua no campo.
 */
describe('fromStoredValue — formas de expressão do Bitrix', () => {
  it.each([
    '{{=Document:UF_CRM_123}}',
    '{=Document:UF_CRM_123}',
    '{{ =Document: UF_CRM_123 }}',
    '{=Document:UF_CRM_123_printable}',
    '{{=Document:UF_CRM_123 > printable}}',
  ])('reconhece %s como campo do documento', raw => {
    expect(fromStoredValue(raw)).toEqual({
      mode: 'document',
      value: 'UF_CRM_123',
    })
  })

  /**
   * Variável de workflow é expressão do Bitrix como qualquer outra: não é campo do
   * documento, mas também não é texto — reescrevê-la quebraria a automação.
   */
  it('variável do workflow vira expressão preservada', () => {
    expect(fromStoredValue('{{=Variable:Variable1}}')).toEqual({
      mode: 'expression',
      value: '{{=Variable:Variable1}}',
    })
  })

  it('texto com expressão no meio continua literal', () => {
    expect(fromStoredValue('Pedido {{=Document:TITLE}} enviado')).toEqual({
      mode: 'literal',
      value: 'Pedido {{=Document:TITLE}} enviado',
    })
  })

  it('reconhece o valor que volta só com o id, quando o id é campo conhecido', () => {
    const known = new Set(['TITLE', 'UF_CRM_9'])

    expect(fromStoredValue('UF_CRM_9', known)).toEqual({
      mode: 'document',
      value: 'UF_CRM_9',
    })
    expect(fromStoredValue('UF_CRM_OUTRO', known).mode).toBe('literal')
    expect(fromStoredValue('UF_CRM_9').mode).toBe('literal')
  })

  it('propaga os ids conhecidos ao recompor o estado', () => {
    const parsed = parseStoredProperties(
      {
        templateName: 't',
        templateLanguage: 'pt_BR',
        templateBody: '{{um}} e {{dois}}',
        templateParameters: ['fixo', '{=Document:UF_CRM_9}'],
        destination: 'PHONE',
      },
      new Set(['PHONE', 'UF_CRM_9']),
    )

    expect(parsed.values.dois).toEqual({
      mode: 'document',
      value: 'UF_CRM_9',
    })
    expect(parsed.values.um).toEqual({ mode: 'literal', value: 'fixo' })
    expect(parsed.destination).toEqual({ mode: 'document', value: 'PHONE' })
  })
})

/**
 * `current_values` de produção trouxe token de três chaves com rótulo legível:
 * `{{{[Hariel] ID Negócio}}}`, `{{{[Criar usando fonte] ID Empresa}}}`. O rótulo entre
 * colchetes é o passo da automação, então o token pode apontar para retorno de outro
 * robô — valor que esta tela não sabe produzir e não deve reescrever.
 */
describe('token do seletor nativo do Bitrix', () => {
  it('reabre como expressão, verbatim', () => {
    expect(fromStoredValue('{{{[Hariel] ID Negócio}}}')).toEqual({
      mode: 'expression',
      value: '{{{[Hariel] ID Negócio}}}',
    })
  })

  it('sobrevive à ida e volta sem ganhar chaves', () => {
    const token = '{{{[Criar usando fonte] ID Empresa}}}'

    expect(toStoredValue(fromStoredValue(token))).toBe(token)
  })

  it('mostra o rótulo sem as chaves', () => {
    expect(expressionLabel('{{{[Hariel] ID Negócio}}}')).toBe(
      '[Hariel] ID Negócio',
    )
  })

  // Campo do documento ganha do token: devolve o `select` em vez de valor intocável.
  it('não confunde a expressão de campo do documento com token', () => {
    expect(fromStoredValue('{{=Document:PARENT_ID_1276}}')).toEqual({
      mode: 'document',
      value: 'PARENT_ID_1276',
    })
  })

  it('recompõe o current_values real do portal', () => {
    const parsed = parseStoredProperties({
      connector: '41',
      destination: '{{{[Hariel] ID Negócio}}}',
      sendToAllRelatedContacts: 'N',
      templateName: 'boas_vindas',
      templateLanguage: 'pt_BR',
      templateBody:
        'Ola {{1}}, seja bem vindo ao canal de atendimento da CRMThink.\nVocê é o número {{2}} da fila de atendimento',
      templateParameters: [
        '{{=Document:PARENT_ID_1276}}',
        '{{{[Criar usando fonte] ID Empresa}}}',
      ],
    })

    expect(parsed.destination.mode).toBe('expression')
    expect(parsed.values['1']).toEqual({
      mode: 'document',
      value: 'PARENT_ID_1276',
    })
    expect(parsed.values['2']).toEqual({
      mode: 'expression',
      value: '{{{[Criar usando fonte] ID Empresa}}}',
    })
  })
})
