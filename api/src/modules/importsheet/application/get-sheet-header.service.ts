import { SpreadsheetHeader } from '../domain/entities/spreadsheet'
import { GoogleSheetsGateway } from '../domain/gateways/google-sheets.gateway'
import { GoogleConnectionService } from './google-connection.service'
import { runWithGoogleTokenRetry } from './run-with-google-token-retry'

export class GetSheetHeaderService {
  constructor(
    private readonly connection: GoogleConnectionService,
    private readonly sheets: GoogleSheetsGateway,
  ) {}
  async execute(
    appId: string,
    spreadsheetId: string,
    tabTitle: string,
  ): Promise<SpreadsheetHeader | null> {
    return runWithGoogleTokenRetry(this.connection, appId, token =>
      this.sheets.getHeaderRow(token, spreadsheetId, tabTitle),
    )
  }
}
