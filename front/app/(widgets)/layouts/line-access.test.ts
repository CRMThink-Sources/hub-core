import { describe, expect, it } from 'vitest'
import { applyLineAccess } from './line-access'

const lines = [{ id: '1' }, { id: '2' }, { id: '3' }]

describe('applyLineAccess', () => {
  it('sem resposta mantém as linhas elegíveis, sem pré-seleção', () => {
    expect(applyLineAccess(lines, null)).toEqual({
      lines,
      autoSelectedId: '',
      locked: false,
      noAccess: false,
    })
  })

  it('instalação sem grupos não pré-seleciona nem com uma linha só', () => {
    const result = applyLineAccess([{ id: '1' }], {
      restricted: false,
      allowedLineIds: [],
    })

    expect(result.lines).toEqual([{ id: '1' }])
    expect(result.autoSelectedId).toBe('')
    expect(result.locked).toBe(false)
  })

  it('uma linha permitida abre selecionada e travada', () => {
    const result = applyLineAccess(lines, {
      restricted: true,
      allowedLineIds: ['2'],
    })

    expect(result).toEqual({
      lines: [{ id: '2' }],
      autoSelectedId: '2',
      locked: true,
      noAccess: false,
    })
  })

  it('várias linhas permitidas abrem sem seleção, só com as permitidas', () => {
    const result = applyLineAccess(lines, {
      restricted: true,
      allowedLineIds: ['1', '3'],
    })

    expect(result).toEqual({
      lines: [{ id: '1' }, { id: '3' }],
      autoSelectedId: '',
      locked: false,
      noAccess: false,
    })
  })

  it('nenhuma linha permitida sinaliza noAccess', () => {
    const result = applyLineAccess(lines, {
      restricted: true,
      allowedLineIds: [],
    })

    expect(result.noAccess).toBe(true)
    expect(result.lines).toEqual([])
    expect(result.locked).toBe(false)
  })

  it('linha permitida que não é elegível (ou foi excluída) não conta', () => {
    const result = applyLineAccess([{ id: '1' }], {
      restricted: true,
      allowedLineIds: ['9'],
    })

    expect(result.noAccess).toBe(true)
    expect(result.autoSelectedId).toBe('')
  })

  it('uma permitida elegível mais órfãos continua travada nela', () => {
    const result = applyLineAccess(lines, {
      restricted: true,
      allowedLineIds: ['3', '99'],
    })

    expect(result.autoSelectedId).toBe('3')
    expect(result.locked).toBe(true)
  })
})
