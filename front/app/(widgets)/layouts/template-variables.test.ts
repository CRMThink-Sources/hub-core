import { describe, expect, it } from 'vitest'
import {
  extractTemplateVariables,
  hasAllTemplateVariables,
  orderedTemplateParameters,
  resolveTemplatePreview,
} from './template-variables'

describe('extractTemplateVariables', () => {
  it('extrai posicionais na ordem de aparição', () => {
    expect(extractTemplateVariables('Olá {{1}}, pedido {{2}}.')).toEqual([
      '1',
      '2',
    ])
  })

  it('extrai nomeadas', () => {
    expect(
      extractTemplateVariables('Olá {{nome}}, código {{codigo}}.'),
    ).toEqual(['nome', 'codigo'])
  })

  it('nome repetido vira um único campo', () => {
    expect(
      extractTemplateVariables('Olá {{nome}}, tudo bem {{nome}}? Ped. {{2}}.'),
    ).toEqual(['nome', '2'])
  })

  it('ordem é a de aparição, não a numérica', () => {
    expect(extractTemplateVariables('{{2}} antes de {{1}}')).toEqual(['2', '1'])
  })

  it('tolera espaços dentro do placeholder', () => {
    expect(extractTemplateVariables('Olá {{ nome }}!')).toEqual(['nome'])
  })

  it('corpo sem placeholder não gera campo', () => {
    expect(extractTemplateVariables('Bom dia!')).toEqual([])
  })
})

describe('resolveTemplatePreview', () => {
  it('substitui os valores preenchidos', () => {
    expect(
      resolveTemplatePreview('Olá {{1}}, pedido {{2}}.', {
        '1': 'Maria',
        '2': '99',
      }),
    ).toBe('Olá Maria, pedido 99.')
  })

  it('mantém o placeholder do que ainda não foi preenchido', () => {
    expect(
      resolveTemplatePreview('Olá {{1}}, pedido {{2}}.', { '1': 'Maria' }),
    ).toBe('Olá Maria, pedido {{2}}.')
  })

  it('valor vazio conta como não preenchido', () => {
    expect(resolveTemplatePreview('Olá {{1}}!', { '1': '' })).toBe('Olá {{1}}!')
  })

  it('nome repetido recebe o mesmo valor', () => {
    expect(
      resolveTemplatePreview('{{nome}} e {{nome}}', { nome: 'Maria' }),
    ).toBe('Maria e Maria')
  })

  it('corpo sem placeholder sai intacto', () => {
    expect(resolveTemplatePreview('Bom dia!', {})).toBe('Bom dia!')
  })
})

describe('orderedTemplateParameters', () => {
  it('devolve os valores na ordem de aparição', () => {
    expect(
      orderedTemplateParameters('{{2}} antes de {{1}}', {
        '1': 'um',
        '2': 'dois',
      }),
    ).toEqual(['dois', 'um'])
  })

  it('variável sem valor vira string vazia', () => {
    expect(orderedTemplateParameters('{{1}} {{2}}', { '1': 'um' })).toEqual([
      'um',
      '',
    ])
  })

  it('template sem variável não manda parâmetro', () => {
    expect(orderedTemplateParameters('Bom dia!', {})).toEqual([])
  })
})

describe('hasAllTemplateVariables', () => {
  it('true quando todas estão preenchidas', () => {
    expect(hasAllTemplateVariables('{{1}} {{2}}', { '1': 'a', '2': 'b' })).toBe(
      true,
    )
  })

  it('false quando falta alguma', () => {
    expect(hasAllTemplateVariables('{{1}} {{2}}', { '1': 'a' })).toBe(false)
  })

  it('só espaço não conta como preenchido', () => {
    expect(hasAllTemplateVariables('{{1}}', { '1': '   ' })).toBe(false)
  })

  it('true para template sem variável', () => {
    expect(hasAllTemplateVariables('Bom dia!', {})).toBe(true)
  })
})
