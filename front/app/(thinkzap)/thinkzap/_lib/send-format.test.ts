import { describe, expect, it } from 'vitest'
import { capitalizeFirst, crmRecordHref } from './send-format'

describe('capitalizeFirst', () => {
  it('sobe a primeira letra', () => {
    expect(capitalizeFirst('motivo não informado')).toBe('Motivo não informado')
  })

  it('trata inicial acentuada', () => {
    expect(capitalizeFirst('é um teste')).toBe('É um teste')
    expect(capitalizeFirst('ótimo')).toBe('Ótimo')
  })

  it('mantém o resto e aceita vazio', () => {
    expect(capitalizeFirst('Já maiúscula')).toBe('Já maiúscula')
    expect(capitalizeFirst('')).toBe('')
  })
})

describe('crmRecordHref', () => {
  const url = '/crm/deal/details/42/'

  it('monta o link absoluto com o domínio do portal', () => {
    expect(crmRecordHref('acme.bitrix24.com.br', url)).toBe(
      'https://acme.bitrix24.com.br/crm/deal/details/42/',
    )
  })

  it('sem domínio devolve o caminho relativo', () => {
    expect(crmRecordHref(undefined, url)).toBe(url)
    expect(crmRecordHref('', url)).toBe(url)
  })

  it('recusa host com esquema, caminho ou espaço', () => {
    expect(crmRecordHref('https://evil.com/x', url)).toBe(url)
    expect(crmRecordHref('evil.com/x', url)).toBe(url)
    expect(crmRecordHref('a b', url)).toBe(url)
  })

  it('não monta link para url que não é caminho relativo', () => {
    expect(crmRecordHref('acme.bitrix24.com.br', '//evil.com/x')).toBe(
      '//evil.com/x',
    )
    expect(crmRecordHref('acme.bitrix24.com.br', 'https://evil.com')).toBe(
      'https://evil.com',
    )
  })
})
