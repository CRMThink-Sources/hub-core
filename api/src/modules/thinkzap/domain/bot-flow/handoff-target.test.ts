import { describe, expect, it } from 'vitest'
import type { BotFlowGraph, HandoffTarget } from './flow'
import { parseBotFlowGraph, validateFlowGraph } from './flow.schema'

const comAlvo = (target: HandoffTarget): BotFlowGraph => ({
  entryNodeId: 'a',
  settings: { escapeKeywords: [], escapeNext: null },
  nodes: [
    { id: 'a', kind: 'message', text: 'oi', next: 'b' },
    { id: 'b', kind: 'handoff', target },
  ],
})

const codes = (graph: unknown): string[] =>
  validateFlowGraph(graph).map(issue => issue.code)

// Id vazio é estado normal de rascunho, mas o `min(1)` do zod reprovava o graph inteiro
// como `malformed`, sem dizer qual bloco.
describe('alvo de handoff', () => {
  it('aceita os três alvos', () => {
    expect(parseBotFlowGraph(comAlvo({ type: 'queue' }))).not.toBeNull()
    expect(
      parseBotFlowGraph(comAlvo({ type: 'user', bitrixUserId: '12' })),
    ).not.toBeNull()
    expect(
      parseBotFlowGraph(comAlvo({ type: 'line', lineId: '7' })),
    ).not.toBeNull()
  })

  it('alvo completo não gera problema', () => {
    expect(codes(comAlvo({ type: 'user', bitrixUserId: '12' }))).toEqual([])
    expect(codes(comAlvo({ type: 'line', lineId: '7' }))).toEqual([])
    expect(codes(comAlvo({ type: 'queue' }))).toEqual([])
  })

  it('id vazio é problema de conteúdo, não de forma', () => {
    const rascunho = comAlvo({ type: 'user', bitrixUserId: '' })

    expect(parseBotFlowGraph(rascunho)).not.toBeNull()
    expect(codes(rascunho)).toEqual(['handoff-target-incomplete'])
  })

  it('aponta o bloco e diz qual escolha falta', () => {
    const issues = validateFlowGraph(comAlvo({ type: 'line', lineId: '   ' }))

    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('handoff-target-incomplete')
    expect(issues[0]?.nodeId).toBe('b')
    expect(issues[0]?.detail).toContain('canal')
  })

  it('`queue` nunca fica incompleto: não tem id para escolher', () => {
    expect(codes(comAlvo({ type: 'queue' }))).not.toContain(
      'handoff-target-incomplete',
    )
  })
})

// O ramo nasce com `var: ''`, e o zod reprovava o grafo inteiro como `malformed`: o
// rascunho deixava de salvar.
describe('variável da condição', () => {
  const comVar = (nome: string): BotFlowGraph => ({
    entryNodeId: 'a',
    settings: { escapeKeywords: [], escapeNext: null },
    nodes: [
      {
        id: 'a',
        kind: 'condition',
        branches: [{ when: { var: nome, op: 'notEmpty' }, next: 'b' }],
        otherwise: 'c',
      },
      { id: 'b', kind: 'finish' },
      { id: 'c', kind: 'finish' },
    ],
  })

  it('nome válido não gera problema', () => {
    expect(codes(comVar('clienteId'))).toEqual([])
  })

  it('em branco salva mas não publica', () => {
    const rascunho = comVar('')

    expect(parseBotFlowGraph(rascunho)).not.toBeNull()
    expect(codes(rascunho)).toEqual(['condition-var-invalid'])
  })

  it('aponta qual condição e o que falta', () => {
    const [issue] = validateFlowGraph(comVar('   '))

    expect(issue?.nodeId).toBe('a')
    expect(issue?.detail).toContain('condição 1')
    expect(issue?.detail).toContain('escolha a variável')
  })

  it('nome inválido diz que é inválido, não que falta', () => {
    const [issue] = validateFlowGraph(comVar('nome do cliente'))

    expect(issue?.code).toBe('condition-var-invalid')
    expect(issue?.detail).toContain('não é um nome de variável válido')
  })

  it('os dois ramos em finish, com variável: publicável', () => {
    expect(validateFlowGraph(comVar('clienteId'))).toEqual([])
  })
})

// `makeNode` cria todo bloco com `text: ''` e o schema exigia `min(1)`: criar um bloco
// tornava o fluxo insalvável, com `PATCH` respondendo "Invalid request" sem dizer o campo.
describe('texto vazio no bloco', () => {
  const base = (nodes: BotFlowGraph['nodes']): BotFlowGraph => ({
    entryNodeId: 'a',
    settings: { escapeKeywords: [], escapeNext: null },
    nodes,
  })

  it('encerrar sem mensagem salva e publica', () => {
    const graph = base([
      {
        id: 'a',
        kind: 'condition',
        branches: [{ when: { var: 'clienteId', op: 'notEmpty' }, next: 'b' }],
        otherwise: 'c',
      },
      { id: 'b', kind: 'finish', text: '' },
      { id: 'c', kind: 'finish', text: '' },
    ])

    expect(parseBotFlowGraph(graph)).not.toBeNull()
    expect(codes(graph)).toEqual([])
  })

  it('texto vazio de handoff/finish vira ausente', () => {
    const parsed = parseBotFlowGraph(
      base([
        { id: 'a', kind: 'handoff', text: '   ', target: { type: 'queue' } },
      ]),
    )

    // `''` e `'   '` significam "entrega calada", normalizada para `undefined`.
    expect(parsed?.nodes[0]).not.toHaveProperty('text', '')
    expect(
      (parsed?.nodes[0] as { text?: string } | undefined)?.text,
    ).toBeUndefined()
  })

  it('mensagem sem texto salva mas não publica', () => {
    const graph = base([
      { id: 'a', kind: 'message', text: '', next: 'b' },
      { id: 'b', kind: 'finish' },
    ])

    expect(parseBotFlowGraph(graph)).not.toBeNull()
    expect(codes(graph)).toEqual(['node-text-missing'])
  })

  it('aponta o bloco e o que escrever', () => {
    const [issue] = validateFlowGraph(
      base([
        {
          id: 'a',
          kind: 'question',
          text: '  ',
          options: [{ label: 'x', value: 'x', next: 'b' }],
          maxAttempts: 2,
          onExhausted: 'b',
        },
        { id: 'b', kind: 'finish' },
      ]),
    )

    expect(issue?.code).toBe('node-text-missing')
    expect(issue?.nodeId).toBe('a')
    expect(issue?.detail).toContain('pergunta')
  })
})
