import { describe, expect, it } from 'vitest'
import {
  appendWidgetButton,
  buttonComposerValidationMessage,
  MAX_WIDGET_BUTTONS,
  toButtonPayload,
  type WidgetButtonEntry,
} from './button-composer'

const officialTypes: ('REPLY' | 'URL' | 'CALL')[] = ['URL']
const allTypes: ('REPLY' | 'URL' | 'CALL')[] = ['REPLY', 'URL', 'CALL']

describe('buttonComposerValidationMessage', () => {
  it('exige o corpo', () => {
    expect(buttonComposerValidationMessage('', [], allTypes)).toMatch(/corpo/i)
  })

  it('exige ao menos um botão', () => {
    expect(buttonComposerValidationMessage('Oi', [], allTypes)).toMatch(
      /botão/i,
    )
  })

  it('recusa tipo de botão não permitido pela linha selecionada', () => {
    const buttons: WidgetButtonEntry[] = [
      { id: '1', label: 'Sim', type: 'REPLY', value: '' },
    ]

    expect(
      buttonComposerValidationMessage('Oi', buttons, officialTypes),
    ).toMatch(/não aceita/i)
  })

  it('recusa misturar REPLY com URL/CALL', () => {
    const buttons: WidgetButtonEntry[] = [
      { id: '1', label: 'Sim', type: 'REPLY', value: '' },
      { id: '2', label: 'Site', type: 'URL', value: 'https://x.io' },
    ]

    expect(buttonComposerValidationMessage('Oi', buttons, allTypes)).toMatch(
      /combinar/i,
    )
  })

  it('exige o texto do botão', () => {
    const buttons: WidgetButtonEntry[] = [
      { id: '1', label: '', type: 'URL', value: 'https://x.io' },
    ]

    expect(buttonComposerValidationMessage('Oi', buttons, allTypes)).toMatch(
      /texto/i,
    )
  })

  it('exige o link do botão URL', () => {
    const buttons: WidgetButtonEntry[] = [
      { id: '1', label: 'Site', type: 'URL', value: '' },
    ]

    expect(buttonComposerValidationMessage('Oi', buttons, allTypes)).toMatch(
      /link/i,
    )
  })

  it('exige o telefone do botão CALL', () => {
    const buttons: WidgetButtonEntry[] = [
      { id: '1', label: 'Ligar', type: 'CALL', value: '' },
    ]

    expect(buttonComposerValidationMessage('Oi', buttons, allTypes)).toMatch(
      /telefone/i,
    )
  })

  it('aceita configuração completa', () => {
    const buttons: WidgetButtonEntry[] = [
      { id: '1', label: 'Site', type: 'URL', value: 'https://x.io' },
    ]

    expect(
      buttonComposerValidationMessage('Oi', buttons, officialTypes),
    ).toBeNull()
  })

  /**
   * A Cloud API da Meta não combina múltiplos botões de URL numa mensagem de
   * sessão livre — confirmado contra a API real em 2026-09-15.
   */
  it('recusa mais botões que maxButtons permite', () => {
    const buttons: WidgetButtonEntry[] = [
      { id: '1', label: 'Site', type: 'URL', value: 'https://x.io' },
      { id: '2', label: 'Outro site', type: 'URL', value: 'https://y.io' },
    ]

    expect(buttonComposerValidationMessage('Oi', buttons, ['URL'], 1)).toMatch(
      /máximo/i,
    )
  })

  it('aceita um único botão dentro de maxButtons', () => {
    const buttons: WidgetButtonEntry[] = [
      { id: '1', label: 'Site', type: 'URL', value: 'https://x.io' },
    ]

    expect(
      buttonComposerValidationMessage('Oi', buttons, ['URL'], 1),
    ).toBeNull()
  })
})

describe('limite geral de botões', () => {
  const replies = (count: number): WidgetButtonEntry[] =>
    Array.from({ length: count }, (_, index) => ({
      id: String(index + 1),
      label: `Opção ${index + 1}`,
      type: 'REPLY' as const,
      value: '',
    }))

  it('é 5', () => {
    expect(MAX_WIDGET_BUTTONS).toBe(5)
  })

  it('aceita 5 botões sem maxButtons', () => {
    expect(
      buttonComposerValidationMessage('Oi', replies(5), allTypes),
    ).toBeNull()
  })

  it('recusa o 6º botão sem maxButtons', () => {
    expect(buttonComposerValidationMessage('Oi', replies(6), allTypes)).toBe(
      'Esta linha aceita no máximo 5 botão(ões) por envio.',
    )
  })
})

describe('appendWidgetButton', () => {
  it('acrescenta resposta rápida preservando a anterior', () => {
    const previous: WidgetButtonEntry[] = [
      { id: '1', label: 'Sim', type: 'REPLY', value: '' },
    ]

    const next = appendWidgetButton(previous, 'REPLY')

    expect(next).toHaveLength(2)
    expect(next[0]).toEqual(previous[0])
    expect(next[1]).toMatchObject({ label: '', type: 'REPLY' })
  })

  it('cria a primeira resposta rápida numa lista vazia', () => {
    const next = appendWidgetButton([], 'REPLY')

    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ label: '', type: 'REPLY' })
  })

  it('acumula link e ligação', () => {
    const previous: WidgetButtonEntry[] = [
      { id: '1', label: 'Site', type: 'URL', value: 'https://x.io' },
    ]

    const next = appendWidgetButton(previous, 'CALL')

    expect(next).toHaveLength(2)
    expect(next[0]).toEqual(previous[0])
    expect(next[1]).toMatchObject({ type: 'CALL' })
  })

  it('reinicia a lista ao trocar de família', () => {
    const previous: WidgetButtonEntry[] = [
      { id: '1', label: 'Site', type: 'URL', value: 'https://x.io' },
    ]

    const next = appendWidgetButton(previous, 'REPLY')

    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ label: '', type: 'REPLY' })
  })
})

describe('toButtonPayload', () => {
  it('converte botão URL', () => {
    expect(
      toButtonPayload({
        id: '1',
        label: 'Site',
        type: 'URL',
        value: 'https://x.io',
      }),
    ).toEqual({ id: '1', label: 'Site', type: 'URL', url: 'https://x.io' })
  })

  it('converte botão CALL', () => {
    expect(
      toButtonPayload({
        id: '1',
        label: 'Ligar',
        type: 'CALL',
        value: '5511999999999',
      }),
    ).toEqual({
      id: '1',
      label: 'Ligar',
      type: 'CALL',
      phone: '5511999999999',
    })
  })

  it('converte botão REPLY sem campo extra', () => {
    expect(
      toButtonPayload({ id: '1', label: 'Sim', type: 'REPLY', value: '' }),
    ).toEqual({ id: '1', label: 'Sim', type: 'REPLY' })
  })
})
