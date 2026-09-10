import { DEFAULT_FLOW_SETTINGS, type BotFlowGraph } from './flow'

// Fluxo novo. Em branco de verdade não é representável: o schema exige ao menos um nó e uma
// entrada que aponte para ele.
//
// Abre com a saudação porque é o primeiro passo de qualquer atendimento, e o texto é um
// exemplo para editar, não um valor a manter. A saída aponta para o próprio bloco, que é a
// convenção de "sem destino", então o fluxo nasce com `no-terminal-reachable`: problema
// listado no editor, não erro.
export const EMPTY_GRAPH: BotFlowGraph = {
  entryNodeId: 'n1',
  nodes: [
    {
      id: 'n1',
      kind: 'message',
      position: { x: 0, y: 0 },
      name: 'Boas-vindas',
      text: 'Olá! Sou o atendimento automático. Como posso ajudar?',
      next: 'n1',
    },
  ],
  settings: {
    ...DEFAULT_FLOW_SETTINGS,
    escapeKeywords: [...DEFAULT_FLOW_SETTINGS.escapeKeywords],
  },
}
