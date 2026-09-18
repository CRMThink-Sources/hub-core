import { describe, expect, it } from 'vitest'
import {
  buildButtonRobotProperties,
  parseStoredButtonProperties,
  validateButtonConfig,
  type ButtonRobotConfigState,
} from './button-robot-config'

const base: ButtonRobotConfigState = {
  connector: 'item_1',
  destination: { mode: 'literal', value: '5511999999999' },
  sendToAllRelatedContacts: false,
  body: 'Como podemos ajudar?',
  header: 'Título',
  footer: 'Rodapé',
  buttons: [
    { id: '1', label: 'Site', type: 'URL', value: 'https://x.io' },
    { id: '2', label: 'Ligar', type: 'CALL', value: '5511888888888' },
  ],
}

describe('buildButtonRobotProperties', () => {
  it('grava todas as propriedades que o webhook lê', () => {
    expect(buildButtonRobotProperties(base)).toEqual({
      connector: 'item_1',
      destination: '5511999999999',
      sendToAllRelatedContacts: 'N',
      body: 'Como podemos ajudar?',
      header: 'Título',
      footer: 'Rodapé',
      buttons: ['URL|Site|https://x.io', 'CALL|Ligar|5511888888888'],
    })
  })

  it('grava botão REPLY sem terceiro campo', () => {
    const { buttons } = buildButtonRobotProperties({
      ...base,
      buttons: [{ id: '1', label: 'Sim', type: 'REPLY', value: '' }],
    })

    expect(buttons).toEqual(['REPLY|Sim|'])
  })

  it('grava a alternância ligada como Y', () => {
    expect(
      buildButtonRobotProperties({ ...base, sendToAllRelatedContacts: true })
        .sendToAllRelatedContacts,
    ).toBe('Y')
  })
})

describe('parseStoredButtonProperties', () => {
  it('recompõe o estado a partir do que estava gravado', () => {
    const stored = buildButtonRobotProperties(base)

    expect(parseStoredButtonProperties(stored)).toEqual(base)
  })

  it('aceita a propriedade de botões como objeto indexado', () => {
    const parsed = parseStoredButtonProperties({
      connector: 'item_1',
      body: 'Oi',
      buttons: {
        '1': 'CALL|Ligar|5511999999999',
        '0': 'URL|Site|https://x.io',
      },
    })

    expect(parsed.buttons).toEqual([
      { id: '1', label: 'Site', type: 'URL', value: 'https://x.io' },
      { id: '2', label: 'Ligar', type: 'CALL', value: '5511999999999' },
    ])
  })

  it('descarta entrada com tipo desconhecido', () => {
    const parsed = parseStoredButtonProperties({
      buttons: ['FOO|X|', 'URL|Site|https://x.io'],
    })

    expect(parsed.buttons).toEqual([
      { id: '2', label: 'Site', type: 'URL', value: 'https://x.io' },
    ])
  })

  it('sem nada gravado, lista de botões fica vazia', () => {
    expect(parseStoredButtonProperties({}).buttons).toEqual([])
  })

  it('lê a alternância nas formas que o Bitrix usa', () => {
    expect(
      parseStoredButtonProperties({ sendToAllRelatedContacts: 'Y' })
        .sendToAllRelatedContacts,
    ).toBe(true)
    expect(
      parseStoredButtonProperties({ sendToAllRelatedContacts: 'N' })
        .sendToAllRelatedContacts,
    ).toBe(false)
  })
})

describe('validateButtonConfig', () => {
  const allowedAll: ('REPLY' | 'URL' | 'CALL')[] = ['REPLY', 'URL', 'CALL']
  const officialTypes: ('REPLY' | 'URL' | 'CALL')[] = ['URL', 'CALL']

  it('aceita a configuração completa', () => {
    expect(validateButtonConfig(base, allowedAll)).toBeNull()
  })

  it('exige a linha', () => {
    expect(
      validateButtonConfig({ ...base, connector: '' }, allowedAll),
    ).toMatch(/linha/i)
  })

  it('exige o corpo', () => {
    expect(validateButtonConfig({ ...base, body: '  ' }, allowedAll)).toMatch(
      /corpo/i,
    )
  })

  it('exige ao menos um botão', () => {
    expect(validateButtonConfig({ ...base, buttons: [] }, allowedAll)).toMatch(
      /botão/i,
    )
  })

  it('recusa tipo de botão não permitido pela tela', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [{ id: '1', label: 'Sim', type: 'REPLY', value: '' }],
    }

    expect(validateButtonConfig(config, officialTypes)).toMatch(/REPLY/)
  })

  it('recusa misturar REPLY com URL/CALL', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [
        { id: '1', label: 'Sim', type: 'REPLY', value: '' },
        { id: '2', label: 'Site', type: 'URL', value: 'https://x.io' },
      ],
    }

    expect(validateButtonConfig(config, allowedAll)).toMatch(/combinar/i)
  })

  it('aceita só REPLY', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [{ id: '1', label: 'Sim', type: 'REPLY', value: '' }],
    }

    expect(validateButtonConfig(config, allowedAll)).toBeNull()
  })

  it('exige o texto do botão', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [{ id: '1', label: '', type: 'URL', value: 'https://x.io' }],
    }

    expect(validateButtonConfig(config, allowedAll)).toMatch(/texto/i)
  })

  it('exige o link do botão URL', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [{ id: '1', label: 'Site', type: 'URL', value: '' }],
    }

    expect(validateButtonConfig(config, allowedAll)).toMatch(/link/i)
  })

  it('exige o telefone do botão CALL', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [{ id: '1', label: 'Ligar', type: 'CALL', value: '' }],
    }

    expect(validateButtonConfig(config, allowedAll)).toMatch(/telefone/i)
  })

  it('exige destino quando a alternância está desligada', () => {
    expect(
      validateButtonConfig(
        { ...base, destination: { mode: 'literal', value: '' } },
        allowedAll,
      ),
    ).toMatch(/destino/i)
  })

  it('dispensa o destino quando a alternância está ligada', () => {
    expect(
      validateButtonConfig(
        {
          ...base,
          destination: { mode: 'literal', value: '' },
          sendToAllRelatedContacts: true,
        },
        allowedAll,
      ),
    ).toBeNull()
  })

  /**
   * A Cloud API da Meta não combina múltiplos botões de URL numa mensagem de
   * sessão livre — confirmado contra a API real em 2026-09-15.
   */
  it('recusa mais botões que maxButtonsByType permite', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [
        { id: '1', label: 'Site', type: 'URL', value: 'https://x.io' },
        { id: '2', label: 'Outro site', type: 'URL', value: 'https://y.io' },
      ],
    }

    expect(validateButtonConfig(config, ['URL'], { URL: 1 })).toMatch(
      /máximo/i,
    )
  })

  it('aceita um único botão dentro de maxButtonsByType', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [{ id: '1', label: 'Site', type: 'URL', value: 'https://x.io' }],
    }

    expect(validateButtonConfig(config, ['URL'], { URL: 1 })).toBeNull()
  })

  /**
   * O quick reply da HubMessage tem limite próprio, mais alto (3) — o `URL`
   * dessa mesma linha continua em 1. Confirmado contra a API real em
   * 2026-09-18: o 4º botão REPLY faz a Meta recusar a mensagem inteira.
   */
  it('aplica o máximo do tipo em uso, não um número fixo pra tela', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [
        { id: '1', label: 'A', type: 'REPLY', value: '' },
        { id: '2', label: 'B', type: 'REPLY', value: '' },
        { id: '3', label: 'C', type: 'REPLY', value: '' },
      ],
    }

    expect(
      validateButtonConfig(config, ['REPLY', 'URL'], { REPLY: 3, URL: 1 }),
    ).toBeNull()
  })

  it('recusa o 4º botão REPLY mesmo a tela aceitando URL/REPLY', () => {
    const config: ButtonRobotConfigState = {
      ...base,
      buttons: [
        { id: '1', label: 'A', type: 'REPLY', value: '' },
        { id: '2', label: 'B', type: 'REPLY', value: '' },
        { id: '3', label: 'C', type: 'REPLY', value: '' },
        { id: '4', label: 'D', type: 'REPLY', value: '' },
      ],
    }

    expect(
      validateButtonConfig(config, ['REPLY', 'URL'], { REPLY: 3, URL: 1 }),
    ).toMatch(/máximo/i)
  })
})
