import { describe, expect, it } from 'vitest'
import { questionHasInlineOptions } from './thinkzap-question-has-options'

describe('questionHasInlineOptions', () => {
  it('acusa a lista digitada no texto da pergunta', () => {
    expect(
      questionHasInlineOptions('No que posso ajudar?\n1 - Financeiro\n2 - Suporte'),
    ).toBe(true)
  })

  it('cobre os separadores que o operador digita', () => {
    expect(questionHasInlineOptions('1) Sim\n2) Não')).toBe(true)
    expect(questionHasInlineOptions('1. Sim\n2. Não')).toBe(true)
    expect(questionHasInlineOptions('1 · Sim\n2 · Não')).toBe(true)
    expect(questionHasInlineOptions('1: Sim\n2: Não')).toBe(true)
  })

  it('numeração fora de ordem também duplicou', () => {
    expect(questionHasInlineOptions('1 - Sim\n3 - Talvez')).toBe(true)
  })

  it('pergunta sem lista passa', () => {
    expect(questionHasInlineOptions('No que posso ajudar?')).toBe(false)
    expect(questionHasInlineOptions('')).toBe(false)
  })

  // Alarme falso é pior que aviso ausente: o operador aprende a ignorar a faixa.
  it('número solto na frase não é lista', () => {
    expect(
      questionHasInlineOptions('Aguarde 1 - dois minutos e responda'),
    ).toBe(false)
    expect(questionHasInlineOptions('1 - Financeiro')).toBe(false)
  })
})
