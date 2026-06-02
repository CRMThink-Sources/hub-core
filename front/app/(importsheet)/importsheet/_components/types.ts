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
