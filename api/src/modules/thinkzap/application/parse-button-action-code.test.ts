import { describe, expect, it } from 'vitest'
import {
  BUTTON_ACTION_CODE_PREFIX,
  decodeButtonActionCode,
  encodeButtonActionCode,
  isButtonActionCode,
} from './parse-button-action-code'

const descriptor = {
  body: 'Como podemos ajudar?',
  header: 'Título',
  footer: 'Rodapé',
  buttons: [
    { id: '1', label: 'Site', type: 'URL' as const, url: 'https://x.io' },
  ],
}

describe('encodeButtonActionCode / decodeButtonActionCode', () => {
  it('sobrevive à ida e volta', () => {
    expect(decodeButtonActionCode(encodeButtonActionCode(descriptor))).toEqual(
      descriptor,
    )
  })

  it('o código começa com o prefixo', () => {
    expect(encodeButtonActionCode(descriptor)).toContain(
      BUTTON_ACTION_CODE_PREFIX,
    )
  })

  it('preserva corpo com quebra de linha e aspas', () => {
    const withSpecialChars = {
      ...descriptor,
      body: 'Linha 1\nLinha 2 com "aspas" e \'apóstrofo\'',
    }

    expect(
      decodeButtonActionCode(encodeButtonActionCode(withSpecialChars)),
    ).toEqual(withSpecialChars)
  })
})

describe('isButtonActionCode', () => {
  it('reconhece o prefixo', () => {
    expect(isButtonActionCode(encodeButtonActionCode(descriptor))).toBe(true)
  })

  it('texto comum não é código', () => {
    expect(isButtonActionCode('Olá, tudo bem?')).toBe(false)
  })
})

describe('decodeButtonActionCode — mensagem comum', () => {
  it('devolve null para texto sem o prefixo', () => {
    expect(decodeButtonActionCode('Olá, tudo bem?')).toBeNull()
  })

  it('devolve null para vazio', () => {
    expect(decodeButtonActionCode('')).toBeNull()
  })
})

describe('decodeButtonActionCode — código malformado', () => {
  it('devolve null para base64 inválido', () => {
    expect(
      decodeButtonActionCode(`${BUTTON_ACTION_CODE_PREFIX}não é base64 válido`),
    ).toBeNull()
  })

  it('devolve null para JSON que não decodifica para um descriptor válido', () => {
    const badJson = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
      'base64',
    )
    expect(
      decodeButtonActionCode(`${BUTTON_ACTION_CODE_PREFIX}${badJson}`),
    ).toBeNull()
  })

  it('devolve null quando falta o corpo', () => {
    const missingBody = Buffer.from(
      JSON.stringify({ buttons: descriptor.buttons }),
    ).toString('base64')
    expect(
      decodeButtonActionCode(`${BUTTON_ACTION_CODE_PREFIX}${missingBody}`),
    ).toBeNull()
  })

  it('devolve null quando a lista de botões está vazia', () => {
    const noButtons = Buffer.from(
      JSON.stringify({ body: 'Oi', buttons: [] }),
    ).toString('base64')
    expect(
      decodeButtonActionCode(`${BUTTON_ACTION_CODE_PREFIX}${noButtons}`),
    ).toBeNull()
  })

  it('devolve null quando um botão tem tipo desconhecido', () => {
    const badType = Buffer.from(
      JSON.stringify({
        body: 'Oi',
        buttons: [{ id: '1', label: 'X', type: 'FOO' }],
      }),
    ).toString('base64')
    expect(
      decodeButtonActionCode(`${BUTTON_ACTION_CODE_PREFIX}${badType}`),
    ).toBeNull()
  })
})
