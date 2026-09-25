import { describe, expect, it } from 'vitest'
import type { BotFlowGraph } from './flow'
import { handoffSummary } from './handoff-summary'

const graph: BotFlowGraph = {
  entryNodeId: 'n1',
  settings: { escapeKeywords: [], escapeTarget: null },
  nodes: [
    {
      id: 'n1',
      kind: 'message',
      name: 'Boas-vindas',
      text: 'Olá! Como posso ajudar?',
      capture: 'assunto',
      next: 'n2',
    },
    {
      id: 'n2',
      kind: 'question',
      text: 'x burguer ou x salada?',
      options: [
        { value: 'burguer', label: 'X Burguer', next: 'n3' },
        { value: 'salada', label: 'X Salada', next: 'n3' },
      ],
      capture: 'lanche',
      maxAttempts: 2,
      onExhausted: 'n3',
    },
    { id: 'n3', kind: 'handoff', target: { type: 'queue' } },
  ],
}

describe('handoffSummary', () => {
  it('usa o nome do bloco e, sem nome, a pergunta feita', () => {
    const texto = handoffSummary(graph, {
      'capture.assunto': 'quero pedir',
      'capture.lanche': 'burguer',
    })

    expect(texto).toBe(
      [
        'Resumo do atendimento automático',
        '',
        '• Boas-vindas: quero pedir',
        '• x burguer ou x salada?: burguer',
      ].join('\n'),
    )
  })

  it('sai na ordem em que o cliente respondeu, não na ordem do grafo', () => {
    const texto = handoffSummary(graph, {
      'capture.lanche': 'salada',
      'capture.assunto': 'quero pedir',
    })

    expect(texto.indexOf('salada')).toBeLessThan(texto.indexOf('quero pedir'))
  })

  it('ignora o que veio do portal: o operador já vê o contato', () => {
    const texto = handoffSummary(graph, {
      'bitrix.name': 'Gustavo Henrique',
      'bitrix.contactId': '9520',
      'capture.assunto': 'quero pedir',
    })

    expect(texto).not.toContain('Gustavo Henrique')
    expect(texto).toContain('• Boas-vindas: quero pedir')
  })

  it('diz que não houve resposta em vez de sussurrar uma lista vazia', () => {
    expect(handoffSummary(graph, { 'bitrix.name': 'Gustavo' })).toContain(
      'O cliente não respondeu nada antes da transferência.',
    )
  })

  it('corta resposta longa: o sussurro é contexto, não transcrição', () => {
    const texto = handoffSummary(graph, { 'capture.assunto': 'a'.repeat(500) })

    expect(texto).toContain('…')
    expect(texto.length).toBeLessThan(300)
  })

  it('variável de bloco que já não existe sai pelo próprio nome', () => {
    const texto = handoffSummary(graph, { 'capture.sumiu': 'valor' })

    expect(texto).toContain('• sumiu: valor')
  })
})

describe('handoffSummary — menus sem captura', () => {
  const menus: BotFlowGraph = {
    entryNodeId: 'setor',
    settings: { escapeKeywords: [], escapeTarget: null },
    nodes: [
      {
        id: 'setor',
        kind: 'question',
        name: 'pergunta setor',
        text: 'Para qual setor posso te ajudar?',
        options: [
          { value: 'suporte', label: 'Suporte', next: 'protocolo' },
          { value: 'financeiro', label: 'Financeiro', next: 'protocolo' },
        ],
        maxAttempts: 2,
        onExhausted: 'fim',
      },
      {
        id: 'protocolo',
        kind: 'message',
        name: 'captura protocolo',
        text: 'Qual o seu protocolo?',
        capture: 'protocolo',
        next: 'fim',
      },
      { id: 'fim', kind: 'handoff', target: { type: 'queue' } },
    ],
  }

  it('traz a opção escolhida, não só o que o cliente digitou', () => {
    const texto = handoffSummary(menus, {
      'choice.setor': 'Suporte',
      'capture.protocolo': '753951',
    })

    expect(texto).toBe(
      [
        'Resumo do atendimento automático',
        '',
        '• pergunta setor: Suporte',
        '• captura protocolo: 753951',
      ].join('\n'),
    )
  })

  it('escolha de bloco que já não existe sai pelo id', () => {
    expect(handoffSummary(menus, { 'choice.sumiu': 'Suporte' })).toContain(
      '• sumiu: Suporte',
    )
  })
})
