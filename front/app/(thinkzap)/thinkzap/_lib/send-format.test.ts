import { describe, expect, it } from 'vitest'
import {
  BITRIX_CLOUD_TLDS,
  capitalizeFirst,
  crmRecordHref,
} from './send-format'

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

  it('monta o link absoluto para portal em nuvem do Bitrix24', () => {
    expect(crmRecordHref('acme.bitrix24.com.br', url)).toBe(
      'https://acme.bitrix24.com.br/crm/deal/details/42/',
    )
    expect(crmRecordHref('acme.bitrix24.com', url)).toBe(
      'https://acme.bitrix24.com/crm/deal/details/42/',
    )
  })

  it('aceita todos os domínios de nuvem conhecidos', () => {
    for (const tld of BITRIX_CLOUD_TLDS) {
      expect(crmRecordHref('acme.bitrix24.' + tld, url)).not.toBeNull()
    }
  })

  it('normaliza maiúsculas do domínio', () => {
    expect(crmRecordHref('ACME.Bitrix24.com.br', url)).toBe(
      'https://acme.bitrix24.com.br/crm/deal/details/42/',
    )
  })

  it.each([
    undefined,
    null,
    '',
    'evil.com',
    'localhost',
    '1.2.3.4',
    'a..bitrix24.com',
    'a..b',
    'bitrix24.com.evil.com',
    'acme.bitrix24.com.evil.com',
    'evil-bitrix24.com',
    'acme.bitrix24.com:8080',
    'acme.bitrix24.com/x',
    'user:pw@acme.bitrix24.com',
    'https://acme.bitrix24.com',
    '-a.bitrix24.com',
    'a-.bitrix24.com',
    'acme.bitrix24.xyz',
    'bitrix24.com',
    'a'.repeat(64) + '.bitrix24.com',
  ])('host inválido (%s) não gera link', host => {
    expect(crmRecordHref(host, url)).toBeNull()
  })

  it.each([
    '//evil.com/x',
    'https://evil.com',
    '/\\evil.com',
    'javascript:alert(1)',
    '',
    '/crm/../x',
    '/crm/',
    '/other/deal/1/',
    '/crm/deal/1/?a=b',
    '/crm/deal/1/#x',
  ])('url inválida (%s) não gera link', badUrl => {
    expect(crmRecordHref('acme.bitrix24.com', badUrl)).toBeNull()
  })
})
