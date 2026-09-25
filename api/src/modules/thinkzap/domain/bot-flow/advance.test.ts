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
  it('guarda a resposta como veio e segue pela condição até a pergunta', () => {
    const opened = start()
    const result = reply(opened.state!, '  14/03/1986  ')

    expect(result.state?.vars).toEqual({ 'capture.nascimento': '14/03/1986' })
    expect(result.awaiting?.id).toBe('n4')
    // A condição no meio não fala nada: só a pergunta sai.
    expect(says(result.effects)).toHaveLength(1)
  })

  it('qualquer resposta é aceita: não existe repetir nem desvio', () => {
    const opened = start()
    const result = reply(opened.state!, 'ontem')

    expect(result.state?.vars).toEqual({ 'capture.nascimento': 'ontem' })
    expect(result.awaiting?.id).toBe('n4')
  })
})

describe('advance — pergunta', () => {
  const atQuestion = (): BotSessionState => ({
    currentNodeId: 'n4',
    vars: { 'capture.nascimento': '1986-03-14' },
    attempts: 0,
  })

  it('casa pelo número da opção', () => {
    const result = reply(atQuestion(), '2')

    expect(result.state?.vars['capture.motivo']).toBe('reagendar')
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

    expect(kinds(manha.effects)).toEqual(['say', 'whisper', 'handoff'])
    expect(kinds(tarde.effects)).toEqual(['say', 'whisper', 'handoff'])
  })

  it('palavra de escape corta o fluxo de qualquer nó de espera', () => {
    const result = reply(
      { currentNodeId: 'n2', vars: {}, attempts: 0 },
      'quero falar com um atendente por favor',
    )

    expect(kinds(result.effects)).toEqual(['say', 'whisper', 'handoff'])
  })

  it('escape só vale quando o fluxo define destino', () => {
    const withoutEscape: BotFlowGraph = {
      ...exampleFlow,
      settings: { escapeKeywords: ['atendente'], escapeTarget: null },
    }

    const result = advance(
      withoutEscape,
      { currentNodeId: 'n2', vars: {}, attempts: 0 },
      { kind: 'text', text: 'atendente' },
    )

    // Sem destino, "atendente" é só o que o cliente respondeu: vira variável e segue.
    expect(kinds(result.effects)).not.toContain('handoff')
    expect(result.state?.vars).toEqual({ 'capture.nascimento': 'atendente' })
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
      settings: { escapeKeywords: [], escapeTarget: null },
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
      settings: { escapeKeywords: [], escapeTarget: null },
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
    expect(kinds(segunda.effects)).toEqual(['say', 'whisper', 'handoff'])
  })
})

describe('advance — variáveis do portal', () => {
  // Captura e despedida: o mínimo para chegar a um segundo turno.
  const despedida: BotFlowGraph = {
    entryNodeId: 'p1',
    settings: { escapeKeywords: [], escapeTarget: null },
    nodes: [
      {
        id: 'p1',
        kind: 'message',
        text: 'oi',
        capture: 'resposta',
        next: 'p2',
      },
      { id: 'p2', kind: 'finish', text: 'tchau {bitrix.name}' },
    ],
  }

  it('rega o nome que o portal só soube depois do JOINCHAT', () => {
    const sessao: BotSessionState = {
      currentNodeId: 'p1',
      vars: { 'bitrix.name': '', 'bitrix.contactId': '9520' },
      attempts: 0,
    }

    const turno = advance(
      despedida,
      sessao,
      { kind: 'text', text: 'oi' },
      { 'bitrix.name': 'Gustavo Henrique', 'bitrix.contactId': '9520' },
    )

    expect(says(turno.effects)).toEqual(['tchau Gustavo Henrique'])
  })

  it('vazio não apaga o que a sessão já sabia', () => {
    const sessao: BotSessionState = {
      currentNodeId: 'p1',
      vars: { 'bitrix.name': 'Gustavo Henrique' },
      attempts: 0,
    }

    const turno = advance(
      despedida,
      sessao,
      { kind: 'text', text: 'oi' },
      {
        'bitrix.name': '',
      },
    )

    expect(says(turno.effects)).toEqual(['tchau Gustavo Henrique'])
  })

  it('a resposta deste turno vence a rega', () => {
    const eco: BotFlowGraph = {
      entryNodeId: 'p1',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        {
          id: 'p1',
          kind: 'message',
          text: 'oi',
          capture: 'resposta',
          next: 'p2',
        },
        { id: 'p2', kind: 'finish', text: 'voce disse {capture.resposta}' },
      ],
    }

    const sessao: BotSessionState = {
      currentNodeId: 'p1',
      vars: { 'capture.resposta': 'antiga' },
      attempts: 0,
    }

    const turno = advance(
      eco,
      sessao,
      { kind: 'text', text: 'nova' },
      { 'capture.resposta': 'do portal' },
    )

    expect(says(turno.effects)).toEqual(['voce disse nova'])
  })
})

describe('advance — rastro das escolhas', () => {
  it('pergunta sem captura guarda o rótulo escolhido para o resumo', () => {
    const menu: BotFlowGraph = {
      entryNodeId: 'q',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        {
          id: 'q',
          kind: 'question',
          text: 'setor?',
          options: [
            { value: 'suporte', label: 'Suporte', next: 'q2' },
            { value: 'financeiro', label: 'Financeiro', next: 'q2' },
          ],
          maxAttempts: 2,
          onExhausted: 'q2',
        },
        { id: 'q2', kind: 'message', text: 'ok', capture: 'x', next: 'fim' },
        { id: 'fim', kind: 'finish' },
      ],
    }

    const turno = advance(
      menu,
      { currentNodeId: 'q', vars: {}, attempts: 0 },
      { kind: 'text', text: '1' },
    )

    expect(turno.state?.vars).toEqual({ 'choice.q': 'Suporte' })
  })

  it('com captura, o rastro não duplica: vale a variável do autor', () => {
    const menu: BotFlowGraph = {
      entryNodeId: 'q',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [
        {
          id: 'q',
          kind: 'question',
          text: 'setor?',
          options: [{ value: 'suporte', label: 'Suporte', next: 'q2' }],
          capture: 'setor',
          maxAttempts: 2,
          onExhausted: 'q2',
        },
        { id: 'q2', kind: 'message', text: 'ok', capture: 'x', next: 'fim' },
        { id: 'fim', kind: 'finish' },
      ],
    }

    const turno = advance(
      menu,
      { currentNodeId: 'q', vars: {}, attempts: 0 },
      { kind: 'text', text: '1' },
    )

    expect(turno.state?.vars).toEqual({ 'capture.setor': 'suporte' })
  })
})
