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
