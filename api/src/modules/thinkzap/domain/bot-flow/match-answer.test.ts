import { describe, expect, it } from 'vitest'
import { matchOption, matchesEscape, normalizeAnswer } from './match-answer'

const node = {
  options: [
    { value: 'confirmar', label: 'Confirmar', next: 'n5' },
    { value: 'reagendar', label: 'Reagendar', next: 'n6' },
    { value: 'cancelar', label: 'Cancelar', next: 'n7' },
  ],
}

describe('normalizeAnswer', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(normalizeAnswer('  Manhã!!  ')).toBe('manha')
  })

  it('preserva @ e ponto, que e-mail precisa', () => {
    expect(normalizeAnswer('Fulano@Empresa.COM')).toBe('fulano@empresa.com')
  })
})

describe('matchOption', () => {
  it('casa pela posição na lista, que é o que o cliente vê', () => {
    const match = matchOption(node, '3')

    expect(match.matched && match.option.value).toBe('cancelar')
    expect(match.matched && match.by).toBe('number')
  })

  it('número fora da lista não casa', () => {
    expect(matchOption(node, '9').matched).toBe(false)
  })

  it('zero não casa — a numeração começa em 1', () => {
    expect(matchOption(node, '0').matched).toBe(false)
  })

  it('casa pelo rótulo escrito à mão, sem acento', () => {
    const match = matchOption(
      { options: [{ value: 'manha', label: 'Manhã', next: 'x' }] },
      'manha',
    )

    expect(match.matched).toBe(true)
  })

  it('casa por prefixo quando ele é único', () => {
    const match = matchOption(node, 'confir')

    expect(match.matched && match.option.value).toBe('confirmar')
  })

  /**
   * O rótulo é o texto que aparece na mensagem, e quase ninguém digita exatamente ele:
   * o cliente responde "ajuda", "boleto", "um". Sem sinônimo tudo isso ia para
   * `onExhausted`, e o operador não tinha como ensinar o bot sem mudar o que o cliente lê.
   */
  describe('sinônimos declarados pelo operador', () => {
    const comAliases = {
      options: [
        {
          value: 'suporte',
          label: 'Suporte',
          aliases: ['ajuda', 'problema', 'tecnico'],
          next: 'n1',
        },
        {
          value: 'financeiro',
          label: 'Financeiro',
          aliases: ['boleto', 'pagamento'],
          next: 'n2',
        },
      ],
    }

    it('casa por sinônimo', () => {
      const match = matchOption(comAliases, 'ajuda')

      expect(match.matched && match.option.value).toBe('suporte')
      expect(match.matched && match.by).toBe('alias')
    })

    it('sinônimo normaliza como o resto: acento e caixa não importam', () => {
      expect(matchOption(comAliases, 'TÉCNICO').matched).toBe(true)
    })

    it('sinônimo da segunda opção não rouba a primeira', () => {
      const match = matchOption(comAliases, 'boleto')

      expect(match.matched && match.option.value).toBe('financeiro')
    })

    it('sinônimo exato vence prefixo de rótulo', () => {
      // "sup" é prefixo de "Suporte" e sinônimo de outra opção: o que o operador
      // declarou tem de ganhar do que o motor adivinha.
      const conflito = {
        options: [
          { value: 'suporte', label: 'Suporte', next: 'n1' },
          {
            value: 'suprimentos',
            label: 'Compras',
            aliases: ['sup'],
            next: 'n2',
          },
        ],
      }

      const match = matchOption(conflito, 'sup')

      expect(match.matched && match.option.value).toBe('suprimentos')
    })

    it('opção sem sinônimo continua funcionando', () => {
      expect(matchOption(node, 'Cancelar').matched).toBe(true)
    })

    it('resposta fora de tudo continua não casando', () => {
      // Sinônimo amplia o que casa, não transforma o bloco em curinga.
      expect(matchOption(comAliases, 'xpto').matched).toBe(false)
    })

    it('sinônimo vazio não casa resposta vazia', () => {
      const comVazio = {
        options: [{ value: 'a', label: 'A', aliases: ['', '  '], next: 'n1' }],
      }

      expect(matchOption(comVazio, '').matched).toBe(false)
      expect(matchOption(comVazio, '   ').matched).toBe(false)
    })
  })

  describe('número escrito por extenso', () => {
    it('"um" leva à primeira opção', () => {
      const match = matchOption(node, 'um')

      expect(match.matched && match.option.value).toBe('confirmar')
      expect(match.matched && match.by).toBe('number')
    })

    it('"tres" sem acento também', () => {
      expect(matchOption(node, 'três').matched).toBe(true)
      expect(matchOption(node, 'tres').matched).toBe(true)
    })

    it('número escrito fora da lista não casa', () => {
      // Só 3 opções: "nove" não inventa destino.
      expect(matchOption(node, 'nove').matched).toBe(false)
    })

    it('não atropela rótulo que é palavra de número', () => {
      // Rótulo exato vem antes do escrito na ordem, então "Dois" casa a opção certa.
      const numerico = {
        options: [
          { value: 'a', label: 'Primeira', next: 'n1' },
          { value: 'b', label: 'Dois', next: 'n2' },
        ],
      }

      const match = matchOption(numerico, 'dois')

      expect(match.matched && match.option.value).toBe('b')
    })
  })

  it('prefixo ambíguo não casa — escolher seria decidir pelo cliente', () => {
    const ambiguous = {
      options: [
        { value: 'cartao', label: 'Cartão', next: 'a' },
        { value: 'cancelar', label: 'Cancelar', next: 'b' },
      ],
    }

    expect(matchOption(ambiguous, 'ca').matched).toBe(false)
  })

  it('vazio não casa', () => {
    expect(matchOption(node, '   ').matched).toBe(false)
  })
})

describe('matchesEscape', () => {
  it('acha a palavra no meio da frase', () => {
    expect(matchesEscape('quero falar com atendente', ['atendente'])).toBe(true)
  })

  it('ignora acento na palavra configurada', () => {
    expect(matchesEscape('preciso de um humano', ['humâno'])).toBe(true)
  })

  it('sem palavras configuradas nunca escapa', () => {
    expect(matchesEscape('atendente', [])).toBe(false)
  })
})
