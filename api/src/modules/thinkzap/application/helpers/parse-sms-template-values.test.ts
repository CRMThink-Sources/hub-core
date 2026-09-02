import { describe, expect, it } from 'vitest'
import { parseSmsTemplateValues } from './parse-sms-template-values'

describe('parseSmsTemplateValues', () => {
  it('lê um valor por linha', () => {
    expect(parseSmsTemplateValues('João\n10/09')).toEqual(['João', '10/09'])
  })

  it('lê valores separados por ponto e vírgula numa linha só', () => {
    expect(parseSmsTemplateValues('João;10/09')).toEqual(['João', '10/09'])
  })

  it('não parte por ponto e vírgula quando há mais de uma linha', () => {
    expect(parseSmsTemplateValues('Consulta; retorno\n10/09')).toEqual([
      'Consulta; retorno',
      '10/09',
    ])
  })

  it('descarta linha em branco', () => {
    expect(parseSmsTemplateValues('\nJoão\n\n10/09\n')).toEqual([
      'João',
      '10/09',
    ])
  })

  it('lê corpo do Windows', () => {
    expect(parseSmsTemplateValues('João\r\n10/09')).toEqual(['João', '10/09'])
  })

  it('devolve lista vazia para corpo vazio — template sem variável', () => {
    expect(parseSmsTemplateValues('')).toEqual([])
    expect(parseSmsTemplateValues('   \n  ')).toEqual([])
  })

  it('lê valor único sem separador', () => {
    expect(parseSmsTemplateValues('João')).toEqual(['João'])
  })

  it('ignora ponto e vírgula sobrando no fim', () => {
    expect(parseSmsTemplateValues('João;10/09;')).toEqual(['João', '10/09'])
  })
})
