import axios from 'axios'
import { SpreadsheetDetails } from '../domain/entities/spreadsheet'
import { GoogleSheetsGateway } from '../domain/gateways/google-sheets.gateway'
import { GoogleAuthRequiredError } from '../domain/errors/google-auth-required.error'
import { GoogleConnectionService } from './google-connection.service'

/** Valida/lê uma planilha Google por ID, renovando o token quando necessário. */
export class GetSpreadsheetService {
  constructor(
    private readonly connection: GoogleConnectionService,
    private readonly sheets: GoogleSheetsGateway,
  ) {}

  /** Retorna os detalhes da planilha, ou null se não existir/sem acesso. */
  async execute(
    appId: string,
    spreadsheetId: string,
  ): Promise<SpreadsheetDetails | null> {
    const accessToken = await this.getToken(appId, false)
    try {
      return await this.sheets.getSpreadsheet(accessToken, spreadsheetId)
    } catch (error) {
      // Token revogado/expirado fora do buffer — força refresh e tenta 1x.
      if (!this.isUnauthorized(error)) throw error
      const fresh = await this.getToken(appId, true)
      try {
        return await this.sheets.getSpreadsheet(fresh, spreadsheetId)
      } catch (retryError) {
        if (this.isUnauthorized(retryError)) throw new GoogleAuthRequiredError()
        throw retryError
      }
    }
  }

  private async getToken(appId: string, force: boolean): Promise<string> {
    try {
      return await this.connection.getAccessToken(appId, force)
    } catch (error) {
      if (this.isAuthFailure(error)) throw new GoogleAuthRequiredError()
      throw error
    }
  }

  private isUnauthorized(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 401
  }

  private isAuthFailure(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      return status === 400 || status === 401
    }
    return (
      error instanceof Error && error.message.includes('connection not found')
    )
  }
}
