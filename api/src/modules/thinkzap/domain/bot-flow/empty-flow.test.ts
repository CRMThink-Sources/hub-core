import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH } from './empty-flow'
import { botFlowGraphSchema, validateFlowGraph } from './flow.schema'
import { findNode, isTerminal, outgoing } from './flow'

describe('EMPTY_GRAPH', () => {
  it('passa pelo schema', () => {
    expect(botFlowGraphSchema.safeParse(EMPTY_GRAPH).success).toBe(true)
  })

  // Os três são o mesmo sintoma (saída sem destino) por ângulos diferentes. Código
  // a mais aqui seria fluxo nascendo quebrado.
  it('só acusa o que falta escolher, nada além disso', () => {
    expect(
      validateFlowGraph(EMPTY_GRAPH)
        .map(issue => issue.code)
        .sort(),
    ).toEqual(['loop-without-wait', 'no-terminal-reachable', 'self-target'])
  })

  // Saída apontando para o próprio bloco é a convenção de "pendente".
  it('a entrada não é terminal e nasce com as saídas em aberto', () => {
    const entrada = findNode(EMPTY_GRAPH, EMPTY_GRAPH.entryNodeId)

    expect(entrada).toBeDefined()
    expect(isTerminal(entrada!)).toBe(false)

    const destinos = outgoing(entrada!)
    expect(destinos.length).toBeGreaterThan(0)
    expect(destinos.every(id => id === entrada!.id)).toBe(true)
  })

  it('nasce com um único bloco', () => {
    expect(EMPTY_GRAPH.nodes).toHaveLength(1)
  })

  // Mensagem e não condicional: a saudação é o primeiro passo de todo atendimento, e a
  // condicional que abria antes testava uma variável que nada popula.
  it('a entrada é uma mensagem com texto de exemplo', () => {
    const entrada = findNode(EMPTY_GRAPH, EMPTY_GRAPH.entryNodeId)

    expect(entrada?.kind).toBe('message')
    expect(entrada && 'text' in entrada ? entrada.text : '').not.toBe('')
  })

  it('o bloco abre com posição no canvas', () => {
    expect(EMPTY_GRAPH.nodes.every(node => node.position)).toBe(true)
  })
})
