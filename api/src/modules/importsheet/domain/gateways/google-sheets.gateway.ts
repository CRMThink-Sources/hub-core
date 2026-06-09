import { SpreadsheetDetails, SpreadsheetHeader } from '../entities/spreadsheet'

/** Linha de dados com seu número absoluto (1-based) na planilha. */
export type SpreadsheetRow = {
  row: number
  values: string[]
}

export interface GoogleSheetsGateway {
  getSpreadsheet(
    accessToken: string,
    spreadsheetId: string,
  ): Promise<SpreadsheetDetails | null>

  getHeaderRow(
    accessToken: string,
    spreadsheetId: string,
    tabTitle: string,
  ): Promise<SpreadsheetHeader | null>

  /**
   * Lê uma página de linhas a partir de `fromRow` (1-based), no máximo `limit`.
   * Linhas vazias finais não vêm da API.
   */
  getRows(
    accessToken: string,
    spreadsheetId: string,
    tabTitle: string,
    fromRow: number,
    limit: number,
  ): Promise<SpreadsheetRow[] | null>
}
