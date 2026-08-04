import { describe, expect, it } from 'vitest'
import { requireAbsoluteUrl } from './require-absolute-url'

describe('requireAbsoluteUrl', () => {
  it('aceita http e https', () => {
    expect(requireAbsoluteUrl('http://localhost:3000', 'FRONT_URL')).toBe(
      'http://localhost:3000',
    )
    expect(requireAbsoluteUrl('https://app.exemplo.com', 'FRONT_URL')).toBe(
      'https://app.exemplo.com',
    )
  })

  /**
   * `http://host/` interpolado com `/rota` produziria `http://host//rota`, que o
   * navegador resolve como outro host.
   */
  it('remove barra final, inclusive repetida', () => {
    expect(requireAbsoluteUrl('http://localhost:3000/', 'FRONT_URL')).toBe(
      'http://localhost:3000',
    )
    expect(requireAbsoluteUrl('http://localhost:3000///', 'FRONT_URL')).toBe(
      'http://localhost:3000',
    )
  })

  it('preserva caminho de base', () => {
    expect(requireAbsoluteUrl('https://exemplo.com/app/', 'FRONT_URL')).toBe(
      'https://exemplo.com/app',
    )
  })

  /** O caso que produziu `Not a valid URL` no gateway. */
  it('recusa vazio nomeando a variável', () => {
    expect(() => requireAbsoluteUrl('', 'FRONT_URL')).toThrow(/FRONT_URL/)
    expect(() => requireAbsoluteUrl('   ', 'FRONT_URL')).toThrow(
      /não configurada/,
    )
  })

  it('recusa caminho relativo', () => {
    expect(() => requireAbsoluteUrl('/thinkzap/conexoes', 'FRONT_URL')).toThrow(
      /inválida/,
    )
    expect(() => requireAbsoluteUrl('localhost:3000', 'FRONT_URL')).toThrow(
      /http ou https/,
    )
  })

  /** `new URL` aceita qualquer esquema; só dois servem para retorno de gateway. */
  it('recusa esquema que não é http nem https', () => {
    expect(() => requireAbsoluteUrl('file:///tmp/x', 'FRONT_URL')).toThrow(
      /http ou https/,
    )
    expect(() => requireAbsoluteUrl('ftp://host/x', 'FRONT_URL')).toThrow(
      /http ou https/,
    )
  })

  it('a mensagem nomeia a variável recebida', () => {
    expect(() => requireAbsoluteUrl('', 'OUTRA_VAR')).toThrow(/OUTRA_VAR/)
  })
})
