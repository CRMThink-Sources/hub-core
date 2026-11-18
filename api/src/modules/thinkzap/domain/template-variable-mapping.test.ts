import { describe, expect, it } from 'vitest'
import {
  allowedVariableSources,
  entityTypeIdFromWidgetEntity,
  normalizeVariableMappings,
} from './template-variable-mapping'

describe('allowedVariableSources', () => {
  it.each([
    ['Lead', 1],
    ['Negócio', 2],
    ['SPA', 1060],
  ])('%s lê de si, do contato e da empresa', (_name, id) => {
    expect(allowedVariableSources(id)).toEqual(['self', 'contact', 'company'])
  })

  it('Contato lê de si e da empresa', () => {
    expect(allowedVariableSources(3)).toEqual(['self', 'company'])
  })

  it('Empresa lê só de si', () => {
    expect(allowedVariableSources(4)).toEqual(['self'])
  })
})

describe('normalizeVariableMappings', () => {
  it('descarta variável sem campo e apara o id do campo', () => {
    expect(
      normalizeVariableMappings({
        '1': { source: 'self', fieldId: ' title ' },
        '2': { source: 'contact', fieldId: '  ' },
      }),
    ).toEqual({ '1': { source: 'self', fieldId: 'title' } })
  })
})

describe('entityTypeIdFromWidgetEntity', () => {
  it.each([
    ['lead', 1],
    ['deal', 2],
    ['contact', 3],
    ['company', 4],
    ['DYNAMIC_1060', 1060],
  ])('%s → %s', (entity, expected) => {
    expect(entityTypeIdFromWidgetEntity(entity)).toBe(expected)
  })

  it.each(['quote', 'DYNAMIC_', 'DYNAMIC_x', ''])('%j não é conhecido', e => {
    expect(entityTypeIdFromWidgetEntity(e)).toBeNull()
  })
})
