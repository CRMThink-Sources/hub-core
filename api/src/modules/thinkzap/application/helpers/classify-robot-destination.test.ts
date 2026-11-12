import { describe, expect, it } from 'vitest'
import {
  classifyRobotDestination,
  diagnoseFailedDestinations,
} from './classify-robot-destination'

describe('classifyRobotDestination', () => {
  it.each(['', '   ', '{}', '{{}}', ' { } ', '{ }'])(
    'trata %j como vazio',
    value => {
      expect(classifyRobotDestination(value)).toBe('empty')
    },
  )

  it.each([
    '{{{Contato: Celular}}}',
    '{{Contato: Celular}}',
    'Tel: {{{Contato: Celular}}}',
    '{{{[Criar usando fonte] ID Empresa}}}',
  ])('trata %j como token não resolvido', value => {
    expect(classifyRobotDestination(value)).toBe('unresolved-token')
  })

  it.each(['5511999999999', '+55 11 99999-9999', '1234', 'abc'])(
    'trata %j como outro caso',
    value => {
      expect(classifyRobotDestination(value)).toBe('other')
    },
  )

  // Chave simples com valor é o resultado de uma resolução com sobra de chaves: o
  // telefone está ali, e a normalização de telefone cuida do resto.
  it('não confunde valor resolvido com sobra de chaves', () => {
    expect(classifyRobotDestination('{5511930256909}')).toBe('other')
  })
})

describe('diagnoseFailedDestinations', () => {
  it('sem destinos, não há diagnóstico', () => {
    expect(diagnoseFailedDestinations([])).toBeNull()
  })

  it('só telefone mal formado, não há diagnóstico', () => {
    expect(diagnoseFailedDestinations(['1234', 'abc'])).toBeNull()
  })

  it('devolve o vazio com o valor como chegou', () => {
    expect(diagnoseFailedDestinations(['{}'])).toEqual({
      kind: 'empty',
      value: '{}',
    })
  })

  it('devolve o token com o valor como chegou', () => {
    expect(diagnoseFailedDestinations(['{{{Contato: Celular}}}'])).toEqual({
      kind: 'unresolved-token',
      value: '{{{Contato: Celular}}}',
    })
  })

  it('token ganha de vazio, qualquer que seja a ordem', () => {
    expect(
      diagnoseFailedDestinations(['{}', '1234', '{{{Contato: Celular}}}']),
    ).toEqual({ kind: 'unresolved-token', value: '{{{Contato: Celular}}}' })
  })

  it('vazio ganha de telefone mal formado', () => {
    expect(diagnoseFailedDestinations(['1234', '{}'])).toEqual({
      kind: 'empty',
      value: '{}',
    })
  })
})
