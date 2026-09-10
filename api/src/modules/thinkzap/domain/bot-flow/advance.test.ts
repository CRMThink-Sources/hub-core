import { describe, expect, it } from 'vitest'
import {
  type BotEffect,
  type BotSessionState,
  advance,
  collapseSays,
  renderOptions,
} from './advance'
import { exampleFlow } from './example-flow'
import type { BotFlowGraph } from './flow'

const says = (effects: BotEffect[]): string[] =>
  effects.flatMap(effect => (effect.kind === 'say' ? [effect.text] : []))

const kinds = (effects: BotEffect[]): string[] =>
  effects.map(effect => effect.kind)

const start = () => advance(exampleFlow, null, { kind: 'start' })

const reply = (state: BotSessionState, text: string) =>
  advance(exampleFlow, state, { kind: 'text', text })

const PERGUNTA_N4 =
  'Achei sua consulta: quinta, 14h, com a Dra. Andrade. O que você quer fazer?'

// Numeradas porque o canal não tem botão.
const OPCOES_N4 =
  '1 · Confirmar\n2 · Reagendar\n3 · Cancelar\n4 · Falar com atendente'

describe('advance — abertura', () => {
  it('atravessa mensagem e para no primeiro nó de espera', () => {
    const result = start()

    expect(says(result.effects)).toEqual([
      'Oi! Aqui é a Clínica Andrade.',
      'Para achar sua consulta, me diga sua data de nascimento (dia/mês/ano).',
    ])
    expect(result.awaiting?.id).toBe('n2')
    expect(result.state).toEqual({
      currentNodeId: 'n2',
      vars: {},
      attempts: 0,
    })
  })

  it('duas falas na abertura são uma mensagem só depois de colapsar', () => {
    const collapsed = collapseSays(start().effects)

    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]).toEqual({
      kind: 'say',
      text: 'Oi! Aqui é a Clínica Andrade.\n\nPara achar sua consulta, me diga sua data de nascimento (dia/mês/ano).',
    })
  })
})

describe('advance — captura', () => {
  it('guarda a data normalizada e segue pela condição até a pergunta', () => {
    const opened = start()
    const result = reply(opened.state!, '14/03/1986')

    expect(result.state?.vars).toEqual({ nascimento: '1986-03-14' })
    expect(result.awaiting?.id).toBe('n4')
    // A condição no meio não fala nada: só a pergunta sai.
    expect(says(result.effects)).toHaveLength(1)
  })

  it('data inválida repete com o texto de retry e conta tentativa', () => {
    const opened = start()
    const result = reply(opened.state!, 'ontem')

    expect(says(result.effects)).toEqual([
      'Não consegui ler a data. Manda no formato dia/mês/ano.',
    ])
    expect(result.state).toEqual({
      currentNodeId: 'n2',
      vars: {},
      attempts: 1,
    })
  })

  it('na última tentativa desvia para o handoff em vez de repetir', () => {
    const state: BotSessionState = {
      currentNodeId: 'n2',
      vars: {},
      attempts: 2,
    }
    const result = reply(state, 'nao sei')

    expect(kinds(result.effects)).toEqual(['say', 'handoff'])
    expect(result.state).toBeNull()
    expect(result.awaiting).toBeNull()
  })
})

describe('advance — pergunta', () => {
  const atQuestion = (): BotSessionState => ({
    currentNodeId: 'n4',
    vars: { nascimento: '1986-03-14' },
    attempts: 0,
  })

  it('casa pelo número da opção', () => {
    const result = reply(atQuestion(), '2')

    expect(result.state?.vars.motivo).toBe('reagendar')
    expect(result.awaiting?.id).toBe('n6')
  })

  it('casa pelo texto do rótulo, com acento e caixa diferentes', () => {
    const result = reply(atQuestion(), 'CANCELAR')

    expect(kinds(result.effects)).toEqual(['say', 'finish'])
    expect(result.state).toBeNull()
  })

  it('opção fora da lista repete a pergunta', () => {
    const result = reply(atQuestion(), 'quero um desconto')

    expect(says(result.effects)).toEqual([`${PERGUNTA_N4}\n\n${OPCOES_N4}`])
    expect(result.state?.attempts).toBe(1)
  })

  it('mantém as variáveis já capturadas ao avançar', () => {
    const result = reply(atQuestion(), '1')

    expect(kinds(result.effects)).toEqual(['say', 'finish'])
  })
})

describe('advance — reconvergência e escape', () => {
  it('as duas opções de turno caem no mesmo handoff', () => {
    const atTurno: BotSessionState = {
      currentNodeId: 'n6',
      vars: {},
      attempts: 0,
    }

    const manha = reply(atTurno, 'manhã')
    const tarde = reply(atTurno, '2')

    expect(kinds(manha.effects)).toEqual(['say', 'handoff'])
    expect(kinds(tarde.effects)).toEqual(['say', 'handoff'])
  })

  it('palavra de escape corta o fluxo de qualquer nó de espera', () => {
    const result = reply(
      { currentNodeId: 'n2', vars: {}, attempts: 0 },
      'quero falar com um atendente por favor',
    )

    expect(kinds(result.effects)).toEqual(['say', 'handoff'])
  })

  it('escape só vale quando o fluxo define destino', () => {
    const withoutEscape: BotFlowGraph = {
      ...exampleFlow,
      settings: { escapeKeywords: ['atendente'], escapeNext: null },
    }

    const result = advance(
      withoutEscape,
      { currentNodeId: 'n2', vars: {}, attempts: 0 },
      { kind: 'text', text: 'atendente' },
    )

    // Sem destino, "atendente" é só uma data inválida: repete.
    expect(result.awaiting?.id).toBe('n2')
    expect(result.state?.attempts).toBe(1)
  })
})

describe('advance — fluxo quebrado', () => {
  it('nó atual inexistente aborta em vez de estourar', () => {
    const result = reply(
      { currentNodeId: 'sumiu', vars: {}, attempts: 0 },
      'oi',
    )

    expect(result.effects).toEqual([{ kind: 'abort', reason: 'unknown-node' }])
    expect(result.state).toBeNull()
  })

  it('destino inexistente no meio do caminho aborta', () => {
    const broken: BotFlowGraph = {
      entryNodeId: 'a',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [{ id: 'a', kind: 'message', text: 'oi', next: 'fantasma' }],
    }

    const result = advance(broken, null, { kind: 'start' })

    expect(result.effects.at(-1)).toEqual({
      kind: 'abort',
      reason: 'unknown-node',
    })
  })

  it('ciclo sem espera para no teto de passos em vez de travar o worker', () => {
    const looping: BotFlowGraph = {
      entryNodeId: 'a',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [
        { id: 'a', kind: 'message', text: 'gira', next: 'b' },
        { id: 'b', kind: 'message', text: 'gira', next: 'a' },
      ],
    }

    const result = advance(looping, null, { kind: 'start' })

    expect(result.effects.at(-1)).toEqual({ kind: 'abort', reason: 'loop' })
    expect(result.state).toBeNull()
  })

  it('mensagem sem estado recomeça o fluxo, não descarta', () => {
    const result = advance(exampleFlow, null, { kind: 'text', text: 'oi' })

    expect(result.awaiting?.id).toBe('n2')
  })
})

describe('renderOptions', () => {
  it('numera as opções porque o canal não tem botão', () => {
    const question = exampleFlow.nodes.find(node => node.id === 'n4')!

    expect(renderOptions(question as never)).toBe(
      '1 · Confirmar\n2 · Reagendar\n3 · Cancelar\n4 · Falar com atendente',
    )
  })
})

describe('collapseSays', () => {
  it('não junta falas separadas por uma ação', () => {
    const collapsed = collapseSays([
      { kind: 'say', text: 'a' },
      { kind: 'handoff', target: { type: 'queue' } },
      { kind: 'say', text: 'b' },
    ])

    expect(kinds(collapsed)).toEqual(['say', 'handoff', 'say'])
  })
})

describe('advance — o que o cliente recebe', () => {
  it('a pergunta sai com as opções numeradas, porque o canal não tem botão', () => {
    const atQuestion: BotSessionState = {
      currentNodeId: 'n4',
      vars: {},
      attempts: 0,
    }

    const result = advance(exampleFlow, atQuestion, {
      kind: 'text',
      text: 'xpto',
    })

    expect(says(result.effects)[0]).toContain('1 · Confirmar')
    expect(says(result.effects)[0]).toContain('4 · Falar com atendente')
  })

  it('a re-pergunta repete as opções junto do texto de retry', () => {
    const result = advance(
      exampleFlow,
      { currentNodeId: 'n6', vars: {}, attempts: 0 },
      { kind: 'text', text: 'de madrugada' },
    )

    expect(says(result.effects)).toEqual([
      'Qual turno fica melhor?\n\n1 · Manhã\n2 · Tarde',
    ])
  })

  it('captura não tem opções para listar — sai só o texto', () => {
    const opened = start()

    expect(says(opened.effects).at(-1)).toBe(
      'Para achar sua consulta, me diga sua data de nascimento (dia/mês/ano).',
    )
  })

  it('o número que o cliente vê casa com a opção que ele escolhe', () => {
    const atQuestion: BotSessionState = {
      currentNodeId: 'n4',
      vars: {},
      attempts: 0,
    }
    const asked = advance(exampleFlow, atQuestion, { kind: 'text', text: '?' })
    const linhas = says(asked.effects)[0]!.split('\n')
    const terceira = linhas.find(linha => linha.startsWith('3 · '))

    expect(terceira).toBe('3 · Cancelar')

    const escolha = reply(atQuestion, '3')
    expect(kinds(escolha.effects)).toEqual(['say', 'finish'])
  })
})

describe('advance — tentativas', () => {
  it('maxAttempts conta falhas toleradas, incluindo a atual', () => {
    // n6 tem maxAttempts: 2 → primeira falha repete, segunda desvia.
    const primeira = advance(
      exampleFlow,
      { currentNodeId: 'n6', vars: {}, attempts: 0 },
      { kind: 'text', text: 'nao sei' },
    )
    expect(primeira.awaiting?.id).toBe('n6')
    expect(primeira.state?.attempts).toBe(1)

    const segunda = advance(
      exampleFlow,
      { currentNodeId: 'n6', vars: {}, attempts: 1 },
      { kind: 'text', text: 'ainda nao sei' },
    )
    expect(kinds(segunda.effects)).toEqual(['say', 'handoff'])
  })
})
