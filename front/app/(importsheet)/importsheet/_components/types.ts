/** Status da conexão Google exposto na sessão. */
export type GoogleConnection = {
  connected: boolean
  email: string | null
}

/** Aba (sheet) dentro de uma planilha Google. */
export type SpreadsheetTab = {
  sheetId: number
  title: string
  index: number
  rowCount: number | null
  columnCount: number | null
}

/** Planilha Google validada por ID (metadados + abas). */
export type SpreadsheetDetails = {
  id: string
  name: string
  tabs: SpreadsheetTab[]
}

/** Seleção final do modal: planilha + aba escolhida. */
export type ImportSelection = {
  spreadsheet: SpreadsheetDetails
  tab: SpreadsheetTab
}

/** Coluna do cabeçalho (1ª linha) de uma aba. */
export type SpreadsheetColumn = {
  index: number
  letter: string
  label: string
}

/** Cabeçalho lido da 1ª linha da aba, base pro de-para. */
export type SpreadsheetHeader = {
  spreadsheetId: string
  tabTitle: string
  columns: SpreadsheetColumn[]
}

/** Entidade-alvo do Bitrix24 (CRM). */
export type BitrixEntity = {
  entityTypeId: number
  code?: string
  label: string
  hasCategories?: boolean
  isSpa?: boolean
}

/** Pipeline/funil de uma entidade (ex.: Negócio). */
export type BitrixCategory = {
  id: number
  name: string
}

/** Campo da entidade no Bitrix24. */
export type BitrixField = {
  name: string
  title: string
  type: string
  isRequired: boolean
  isReadOnly: boolean
}

/** Mapeamento de uma coluna da planilha → campo do Bitrix (ou null = ignorar). */
export type ColumnMapping = {
  columnIndex: number
  fieldName: string | null
  /** Marca a coluna como identificador — usada pra dedup contra o Bitrix do cliente. */
  isIdentifier: boolean
}

/** Código da entidade-alvo exibida na seleção. */
export type EntityCode =
  | 'LEAD'
  | 'DEAL'
  | 'CONTACT'
  | 'COMPANY'
  | 'SPA'
  | 'TASK'
  | 'FEED'

/** Forma de casar o valor da coluna "Responsável" com um usuário do Bitrix. */
export type ResponsibleMatchBy = 'id' | 'email' | 'phone'

/** Frequência do agendamento (UI). O DTO de envio usa `ImportScheduleInput`. */
export type ScheduleType = 'hours' | 'days'

/**
 * Agendamento normalizado pro backend. União discriminada por `mode` — só
 * carrega o campo relevante (sem ruído). `manual` = roda sob demanda.
 */
export type ImportScheduleInput =
  | { mode: 'manual' }
  | { mode: 'hours'; everyHours: number }
  | { mode: 'days'; weekdays: number[] }

/** Planilha + aba de origem (refs estáveis; sem metadados voláteis). */
export type ImportSourceInput = {
  spreadsheetId: string
  /** Snapshot do nome da planilha — exibido na lista de importações. */
  spreadsheetName: string
  tab: {
    /** ID estável da aba (sobrevive a rename). */
    sheetId: number
    /** Título da aba — usado pela Sheets API (`values.get`) e exibição. */
    title: string
  }
}

/** Destino no Bitrix24. */
export type ImportTargetInput = {
  entityCode: EntityCode
  /** Resolvido: CRM base = fixo; SPA = o próprio; Tarefas/Livefeed = null. */
  entityTypeId: number | null
  /** Pipeline/funil — só Negócio; demais = null. */
  categoryId: number | null
}

/** Responsável a casar com um usuário do Bitrix; null = sem responsável. */
export type ImportResponsibleInput = {
  columnIndex: number
  matchBy: ResponsibleMatchBy
}

/** Coluna mapeada pro Bitrix (só colunas com campo escolhido). */
export type ColumnMappingInput = {
  columnIndex: number
  /** Snapshot do cabeçalho — facilita exibição/diagnóstico no backend. */
  columnLabel: string
  fieldName: string
  /** Identificador → dedup contra o Bitrix (exige `fieldName`). */
  isIdentifier: boolean
}

/**
 * Configuração da importação — bloco salvo na coluna JSON `config` da tabela
 * `core_importsheets_imports`. Schedule em colunas dedicadas, não aqui.
 */
export type ImportConfig = {
  source: ImportSourceInput
  target: ImportTargetInput
  responsible: ImportResponsibleInput | null
  options: { createContact: boolean; createCompany: boolean }
  mappings: ColumnMappingInput[]
}

/**
 * Payload enviado ao backend (POST /importsheet/imports).
 * `title` e `schedule` viram colunas; `config` é o JSON.
 */
export type CreateImportInput = {
  title: string
  schedule: ImportScheduleInput
  config: ImportConfig
}

/** Modo de agendamento persistido (coluna `schedule_mode`). */
export type ImportScheduleMode = 'MANUAL' | 'HOURS' | 'DAYS'

/**
 * Resumo de uma importação salva (GET /importsheet/imports). Sem o `config`
 * completo — só o que a lista exibe. Datas chegam como ISO string.
 */
export type ImportListItem = {
  id: number
  title: string
  spreadsheetName: string
  entityCode: EntityCode
  scheduleMode: ImportScheduleMode
  everyHours: number | null
  weekdays: number[] | null
  nextRunAt: string | null
  enabled: boolean
  lastRunAt: string | null
  lastRunStatus: string | null
}
