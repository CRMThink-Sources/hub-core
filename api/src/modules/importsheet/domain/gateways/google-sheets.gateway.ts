import { SpreadsheetDetails, SpreadsheetHeader } from '../entities/spreadsheet'

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
}
