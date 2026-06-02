import { SpreadsheetDetails } from '../entities/spreadsheet'

export interface GoogleSheetsGateway {
  getSpreadsheet(
    accessToken: string,
    spreadsheetId: string,
  ): Promise<SpreadsheetDetails | null>
}
