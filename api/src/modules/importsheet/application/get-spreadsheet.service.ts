import { SpreadsheetDetails } from '../domain/entities/spreadsheet'
import { GoogleSheetsGateway } from '../domain/gateways/google-sheets.gateway'
import { GoogleConnectionService } from './google-connection.service'
import { runWithGoogleTokenRetry } from './run-with-google-token-retry'

export class GetSpreadsheetService {
  constructor(
    private readonly connection: GoogleConnectionService,
    private readonly sheets: GoogleSheetsGateway,
  ) {}

  async execute(
    appId: string,
    spreadsheetId: string,
  ): Promise<SpreadsheetDetails | null> {
    return runWithGoogleTokenRetry(this.connection, appId, token =>
      this.sheets.getSpreadsheet(token, spreadsheetId),
    )
  }
}
