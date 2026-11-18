import { describe, expect, it } from 'vitest'
import type { CrmFieldMeta } from './crm-field-catalog'
import {
  formatCrmFieldValue,
  isAmbiguousCrmValue,
} from './format-crm-field-value'

const enumMeta: CrmFieldMeta = {
  type: 'enumeration',
  items: [
    { ID: '10', VALUE: 'Em negociação' },
    { ID: 11, VALUE: 'Ganho' },
  ],
}

describe('formatCrmFieldValue', () => {
  it.each([
    ['lista pelo rótulo', '10', enumMeta, 'Em negociação'],
    ['lista com id numérico', 11, enumMeta, 'Ganho'],
    ['lista com opção desconhecida', '99', enumMeta, undefined],
    [
      'lista múltipla junta rótulos',
      ['10', '11'],
      { ...enumMeta, isMultiple: true },
      'Em negociação, Ganho',
    ],
    ['texto', ' Maria ', { type: 'string' }, 'Maria'],
    ['número com meta', 1500, { type: 'integer' }, '1500'],
    ['dinheiro sem a moeda', '1500|BRL', { type: 'money' }, '1500'],
    ['dinheiro sem meta', '1500.50|BRL', undefined, '1500.50'],
    [
      'data sem deslocar o dia',
      '2026-11-18T00:00:00-03:00',
      { type: 'date' },
      '18/11/2026',
    ],
    ['data sem meta', '2026-01-05', undefined, '05/01/2026'],
    ['sim', 'Y', { type: 'boolean' }, 'Sim'],
    ['não', 'N', { type: 'boolean' }, 'Não'],
    ['booleano nativo', false, { type: 'boolean' }, 'Não'],
  ])('%s', (_name, raw, meta, expected) => {
    expect(formatCrmFieldValue(raw, meta as CrmFieldMeta | undefined)).toBe(
      expected,
    )
  })

  it('telefone traz o primeiro valor', () => {
    const phones = [
      { id: '1', valueType: 'WORK', value: ' ' },
      { id: '2', valueType: 'WORK', value: '+5511999990000' },
      { id: '3', valueType: 'HOME', value: '+5511888880000' },
    ]
    expect(formatCrmFieldValue(phones, { type: 'crm_multifield' })).toBe(
      '+5511999990000',
    )
    // Mesmo sem meta, o formato do multicampo é inequívoco.
    expect(formatCrmFieldValue(phones, undefined)).toBe('+5511999990000')
  })

  it('campo de vários valores junta com vírgula', () => {
    expect(
      formatCrmFieldValue(['a', 'b'], { type: 'string', isMultiple: true }),
    ).toBe('a, b')
  })

  it.each([null, undefined, '', '   ', [], {}, [null]])(
    'valor vazio (%j) fica sem texto',
    raw => {
      expect(formatCrmFieldValue(raw, { type: 'string' })).toBeUndefined()
    },
  )

  it('nunca devolve null/undefined/objeto como texto', () => {
    const out = formatCrmFieldValue({ a: 1 }, { type: 'string' })
    expect(out).toBeUndefined()
  })

  it('valor ambíguo sem meta é omitido, e não mostrado como código', () => {
    expect(formatCrmFieldValue('10', undefined)).toBeUndefined()
    expect(formatCrmFieldValue('Y', undefined)).toBeUndefined()
  })
})

describe('isAmbiguousCrmValue', () => {
  it.each([
    ['10', true],
    [10, true],
    ['Y', true],
    [['1', 'x'], true],
    ['Maria', false],
    ['2026-01-05', false],
    [null, false],
  ])('%j → %s', (raw, expected) => {
    expect(isAmbiguousCrmValue(raw)).toBe(expected)
  })
})
