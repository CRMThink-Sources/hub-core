import { describe, expect, it } from 'vitest'
import {
  type BotFlowGraph,
  NODE_KIND_ORDER,
  makeNode,
  nextOptionValue,
  nodeOutgoing,
  removeNode,
} from './thinkzap-bot-flow'

const graph = (): BotFlowGraph => ({
  entryNodeId: 'n1',
  settings: { escapeKeywords: ['atendente'], escapeTarget: { type: 'queue' } },
  nodes: [
    { id: 'n1', kind: 'message', text: 'oi', next: 'n2' },
    {
      id: 'n2',
      kind: 'question',
      text: 'qual?',
      options: [
        { label: 'A', value: 'opcao-1', next: 'n3' },
        { label: 'B', value: 'opcao-2', next: 'n4' },
      ],
      maxAttempts: 3,
      onExhausted: 'n4',
    },
    { id: 'n3', kind: 'finish', text: 'fim' },
    { id: 'n4', kind: 'handoff', target: { type: 'queue' } },
  ],
})

describe('nextOptionValue', () => {
  it('não reusa valor depois de remover opção do meio', () => {
    // Era o bug: `opcao-${length + 1}` devolvia "opcao-3" com [opcao-1, opcao-3].
    const restantes = [
      { label: 'A', value: 'opcao-1', next: 'n3' },
      { label: 'C', value: 'opcao-3', next: 'n3' },
    ]

    expect(nextOptionValue(restantes)).toBe('opcao-4')
  })

  it('ignora valor fora do padrão em vez de estourar', () => {
    expect(nextOptionValue([{ label: 'X', value: 'vendas', next: 'n3' }])).toBe(
      'opcao-1',
    )
  })
})

describe('removeNode', () => {
  it('religa quem apontava para o passo removido', () => {
    const next = removeNode(graph(), 'n3')

    const pergunta = next.nodes.find(node => node.id === 'n2')
    expect(pergunta?.kind).toBe('question')
    if (pergunta?.kind !== 'question') throw new Error('tipo inesperado')

    // A opção A apontava para n3; n3 era terminal, então herda o que sobrou.
    expect(pergunta.options[0]?.next).not.toBe('n3')
    expect(next.nodes.some(node => node.id === 'n3')).toBe(false)
  })

  it('não deixa destino órfão em nenhuma saída', () => {
    const next = removeNode(graph(), 'n4')
    const ids = new Set(next.nodes.map(node => node.id))

    for (const node of next.nodes) {
      if (node.kind === 'question') {
        for (const option of node.options)
          expect(ids.has(option.next)).toBe(true)
        expect(ids.has(node.onExhausted)).toBe(true)
      }
      if (node.kind === 'message') expect(ids.has(node.next)).toBe(true)
    }
  })

  it('mantém a saída de emergência quando um bloco é removido', () => {
    // Ela transfere direto, sem passar por bloco: remover nó não a afeta.
    expect(removeNode(graph(), 'n4').settings.escapeTarget).toEqual({
      type: 'queue',
    })
  })

  it('move a entrada quando o passo inicial é removido', () => {
    const next = removeNode(graph(), 'n1')

    expect(next.entryNodeId).toBe('n2')
    expect(next.nodes.some(node => node.id === next.entryNodeId)).toBe(true)
  })

  it('não remove o último passo — fluxo sem nó não é editável', () => {
    const single: BotFlowGraph = {
      entryNodeId: 'n1',
      settings: { escapeKeywords: [], escapeTarget: null },
      nodes: [{ id: 'n1', kind: 'finish', text: 'fim' }],
    }

    expect(removeNode(single, 'n1')).toEqual(single)
  })

  it('id inexistente devolve o fluxo intacta', () => {
    const original = graph()
    expect(removeNode(original, 'sumiu')).toEqual(original)
  })
})

describe('makeNode', () => {
  /**
   * Bloco novo nasce pendente: toda saída aponta para o próprio bloco, que é como o
   * fluxo diz "sem destino". Apontar para a entrada — o que ele fazia antes — deixava o
   * bloco já ligado, enchia o canvas de linhas voltando ao início e não dava pista de
   * que aquele destino não tinha sido escolhido por ninguém.
   */
  it('mensagem nasce sem destino', () => {
    const node = makeNode('message', 'n7')
    expect(node.kind === 'message' && node.next).toBe('n7')
  })

  it('pergunta nasce com opção e esgotamento pendentes', () => {
    const node = makeNode('question', 'n7')
    if (node.kind !== 'question') throw new Error('tipo errado')

    expect(node.options.map(option => option.next)).toEqual(['n7'])
    expect(node.onExhausted).toBe('n7')
  })

  it('captura nasce com as duas saídas pendentes', () => {
    const node = makeNode('input', 'n7')
    if (node.kind !== 'input') throw new Error('tipo errado')

    expect([node.next, node.onExhausted]).toEqual(['n7', 'n7'])
  })

  it('condição nasce com ramo e senão pendentes', () => {
    const node = makeNode('condition', 'n7')
    if (node.kind !== 'condition') throw new Error('tipo errado')

    expect([
      ...node.branches.map(branch => branch.next),
      node.otherwise,
    ]).toEqual(['n7', 'n7'])
  })

  it('bloco terminal não tem saída para pendurar', () => {
    expect(nodeOutgoing(makeNode('finish', 'n7'))).toEqual([])
    expect(nodeOutgoing(makeNode('handoff', 'n7'))).toEqual([])
  })

  it('nenhum bloco novo aponta para outro bloco existente', () => {
    // O sintoma que o usuário viu: linha para o início que ele nunca desenhou.
    for (const kind of NODE_KIND_ORDER) {
      const alvos = nodeOutgoing(makeNode(kind, 'n7'))
      expect(alvos.filter(alvo => alvo !== 'n7')).toEqual([])
    }
  })
})
