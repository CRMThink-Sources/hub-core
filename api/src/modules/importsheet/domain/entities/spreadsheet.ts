export type SpreadsheetTab = {
  sheetId: number
  title: string
  index: number
  rowCount: number | null
  columnCount: number | null
}

export type SpreadsheetDetails = {
  id: string
  name: string
  tabs: SpreadsheetTab[]
}

export type SpreadsheetColumn = {
  index: number // posição 0-based
  letter: string // letra A1 (A, B, … AA)
  label: string // texto do cabeçalho (pode ser vazio)
}

export type SpreadsheetHeader = {
  spreadsheetId: string
  tabTitle: string
  columns: SpreadsheetColumn[]
}
