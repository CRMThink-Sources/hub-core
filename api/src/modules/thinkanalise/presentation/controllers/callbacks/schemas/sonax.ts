type TableEntry = { code: string; title: string }
type FieldEntry = { code: string; name: string; type: string }

export const tables: TableEntry[] = [
  { code: 'chamadas', title: 'Chamadas' },
  { code: 'campanhas', title: 'Campanhas' },
  { code: 'filas', title: 'Filas' },
  { code: 'tabulacoes', title: 'Tabulações' },
  { code: 'pausas', title: 'Pausas' },
]

export const schema: Record<string, FieldEntry[]> = {
  chamadas: [
    { code: 'PROTOCOLO', name: 'Protocolo', type: 'string' },
    { code: 'ID_CLIENTE', name: 'ID do Cliente', type: 'string' },
    { code: 'NUMERO', name: 'Número Discado', type: 'string' },
    { code: 'ATENDIDO', name: 'Atendido', type: 'string' },
    { code: 'DATA_INICIO', name: 'Data de Início', type: 'date' },
    { code: 'DATA_FIM', name: 'Data de Fim', type: 'date' },
    { code: 'DURACAO', name: 'Duração (s)', type: 'double' },
    { code: 'TENTATIVAS', name: 'Tentativas', type: 'double' },
    { code: 'TABULACAO', name: 'Tabulação', type: 'string' },
    { code: 'ID_TABULACAO', name: 'ID da Tabulação', type: 'string' },
    { code: 'TIPO_TABULACAO', name: 'Tipo de Tabulação', type: 'string' },
    { code: 'LOGIN_AGENTE', name: 'Login do Agente', type: 'string' },
    { code: 'OBSERVACAO', name: 'Observação', type: 'string' },
  ],

  campanhas: [
    { code: 'ID_CAMPANHA', name: 'ID da Campanha', type: 'string' },
    { code: 'DESCRICAO_CAMPANHA', name: 'Descrição', type: 'string' },
    { code: 'DATA_CRIACAO', name: 'Data de Criação', type: 'date' },
    { code: 'ID_FILA', name: 'ID da Fila', type: 'string' },
    { code: 'QTD_CONTATOS', name: 'Qtd. Contatos', type: 'double' },
    { code: 'STATUS_CAMPANHA', name: 'Status', type: 'string' },
    { code: 'QTD_SIMULTANEAS_PA', name: 'Simultâneas por PA', type: 'double' },
    { code: 'QTD_REPROCESSAMENTOS', name: 'Reprocessamentos', type: 'double' },
  ],

  filas: [
    { code: 'ID_FILA', name: 'ID da Fila', type: 'string' },
    { code: 'DESCRICAO', name: 'Descrição', type: 'string' },
  ],

  tabulacoes: [
    { code: 'ID_TABULACAO', name: 'ID da Tabulação', type: 'string' },
    { code: 'DESCRICAO', name: 'Descrição', type: 'string' },
    { code: 'TIPO', name: 'Tipo (P/N/I)', type: 'string' },
  ],

  pausas: [
    { code: 'ID_PAUSA', name: 'ID da Pausa', type: 'string' },
    { code: 'DESCRICAO', name: 'Descrição', type: 'string' },
    { code: 'TIPO_PAUSA', name: 'Tipo de Pausa', type: 'string' },
  ],
}
