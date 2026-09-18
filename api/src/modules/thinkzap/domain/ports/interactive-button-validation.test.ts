import { describe, expect, it } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  InvalidButtonCombinationError,
  TooManyButtonsError,
  UnsupportedButtonTypeError,
} from './button-errors'
import { assertValidButtonsForProvider } from './interactive-button-validation'
import { ButtonAction } from './interactive-button-sender.port'

const reply: ButtonAction = { id: '1', label: 'Sim', type: 'REPLY' }
const url: ButtonAction = {
  id: '2',
  label: 'Site',
  type: 'URL',
  url: 'https://x.io',
}
const url2: ButtonAction = {
  id: '4',
  label: 'Outro site',
  type: 'URL',
  url: 'https://y.io',
}
const call: ButtonAction = {
  id: '3',
  label: 'Ligar',
  type: 'CALL',
  phone: '5511999999999',
}

describe('assertValidButtonsForProvider', () => {
  it('HUBMESSAGE aceita um único botão URL', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.HUBMESSAGE, [url]),
    ).not.toThrow()
  })

  it('HUBMESSAGE aceita até 3 REPLY', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.HUBMESSAGE, [
        reply,
        { ...reply, id: '5' },
        { ...reply, id: '6' },
      ]),
    ).not.toThrow()
  })

  it('HUBMESSAGE recusa o 4º botão REPLY — limite da Meta, não da HubMessage', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.HUBMESSAGE, [
        reply,
        { ...reply, id: '5' },
        { ...reply, id: '6' },
        { ...reply, id: '7' },
      ]),
    ).toThrow(TooManyButtonsError)
  })

  it('HUBMESSAGE recusa REPLY misturado com URL — rotas diferentes da API', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.HUBMESSAGE, [reply, url]),
    ).toThrow(InvalidButtonCombinationError)
  })

  it('HUBMESSAGE recusa CALL — Meta não tem botão de ligação em sessão livre', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.HUBMESSAGE, [call]),
    ).toThrow(UnsupportedButtonTypeError)
  })

  it('HUBMESSAGE recusa mais de um botão URL', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.HUBMESSAGE, [url, url2]),
    ).toThrow(TooManyButtonsError)
  })

  it('HUBMESSAGE recusa URL combinado com CALL', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.HUBMESSAGE, [url, call]),
    ).toThrow(UnsupportedButtonTypeError)
  })

  it('ZAPI aceita CALL e URL juntos', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.ZAPI, [url, call]),
    ).not.toThrow()
  })

  it('ZAPI aceita só REPLY', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.ZAPI, [reply]),
    ).not.toThrow()
  })

  it('ZAPI recusa REPLY misturado com URL', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.ZAPI, [reply, url]),
    ).toThrow(InvalidButtonCombinationError)
  })

  it('ZAPI recusa REPLY misturado com CALL', () => {
    expect(() =>
      assertValidButtonsForProvider(ConnectorProvider.ZAPI, [reply, call]),
    ).toThrow(InvalidButtonCombinationError)
  })
})
