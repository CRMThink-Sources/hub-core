import { type BotFlowGraph } from './flow'

// Fixture de teste, não modelo de produto: cobre os seis tipos de nó, reconvergência (dois
// ramos no mesmo handoff) e dois términos distintos.
export const exampleFlow: BotFlowGraph = {
  entryNodeId: 'n1',
  settings: {
    escapeKeywords: ['atendente', 'humano'],
    escapeTarget: { type: 'line', lineId: '1' },
    escapeText: 'Já chamo alguém do agendamento para falar com você.',
  },
  nodes: [
    {
      id: 'n1',
      kind: 'message',
      text: 'Oi! Aqui é a Clínica Andrade.',
      next: 'n2',
    },
    {
      id: 'n2',
      kind: 'message',
      text: 'Para achar sua consulta, me diga sua data de nascimento (dia/mês/ano).',
      capture: 'nascimento',
      next: 'n3',
    },
    {
      id: 'n3',
      kind: 'condition',
      branches: [
        { when: { var: 'capture.nascimento', op: 'notEmpty' }, next: 'n4' },
      ],
      otherwise: 'n9',
    },
    {
      id: 'n4',
      kind: 'question',
      text: 'Achei sua consulta: quinta, 14h, com a Dra. Andrade. O que você quer fazer?',
      capture: 'motivo',
      options: [
        { value: 'confirmar', label: 'Confirmar', next: 'n5' },
        { value: 'reagendar', label: 'Reagendar', next: 'n6' },
        { value: 'cancelar', label: 'Cancelar', next: 'n7' },
        { value: 'atendente', label: 'Falar com atendente', next: 'n9' },
      ],
      maxAttempts: 2,
      onExhausted: 'n9',
    },
    {
      id: 'n5',
      kind: 'message',
      text: 'Consulta confirmada. Até quinta!',
      next: 'n8',
    },
    {
      id: 'n6',
      kind: 'question',
      text: 'Qual turno fica melhor?',
      capture: 'turno',
      options: [
        { value: 'manha', label: 'Manhã', next: 'n9' },
        { value: 'tarde', label: 'Tarde', next: 'n9' },
      ],
      maxAttempts: 2,
      onExhausted: 'n9',
    },
    {
      id: 'n7',
      kind: 'message',
      text: 'Consulta cancelada. Se mudar de ideia, chama aqui.',
      next: 'n10',
    },
    { id: 'n8', kind: 'finish' },
    {
      id: 'n9',
      kind: 'handoff',
      text: 'Já chamo alguém do agendamento para falar com você.',
      target: { type: 'line', lineId: '1' },
    },
    { id: 'n10', kind: 'finish' },
  ],
}
