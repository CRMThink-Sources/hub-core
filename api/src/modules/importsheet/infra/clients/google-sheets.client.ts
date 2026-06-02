import axios from 'axios'
import { env } from '@/config/env'
import { SpreadsheetDetails } from '@/modules/importsheet/domain/entities/spreadsheet'
import { GoogleSheetsGateway } from '@/modules/importsheet/domain/gateways/google-sheets.gateway'

type SheetProperties = {
  sheetId?: number
  title?: string
  index?: number
  gridProperties?: { rowCount?: number; columnCount?: number }
}

type SpreadsheetGetResponse = {
  spreadsheetId: string
  properties?: { title?: string }
  sheets?: { properties?: SheetProperties }[]
}

export class GoogleSheetsClient implements GoogleSheetsGateway {
  async getSpreadsheet(
    accessToken: string,
    spreadsheetId: string,
  ): Promise<SpreadsheetDetails | null> {
    try {
      const response = await axios.get<SpreadsheetGetResponse>(
        `${env.google.sheetsApiUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            // Sem grid data (não baixa células) — só metadados das abas.
            includeGridData: false,
            fields:
              'spreadsheetId,properties.title,sheets.properties(sheetId,title,index,gridProperties(rowCount,columnCount))',
          },
          timeout: 15000,
        },
      )
      return this.toDetails(response.data)
    } catch (error) {
      // Inexistente ou sem acesso — trata como "não encontrada".
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 404 || status === 403) return null
      }
      throw error
    }
  }

  private toDetails(data: SpreadsheetGetResponse): SpreadsheetDetails {
    const tabs = (data.sheets ?? [])
      .map(sheet => sheet.properties ?? {})
      .map(props => ({
        sheetId: props.sheetId ?? 0,
        title: props.title ?? '',
        index: props.index ?? 0,
        rowCount: props.gridProperties?.rowCount ?? null,
        columnCount: props.gridProperties?.columnCount ?? null,
      }))
      .sort((a, b) => a.index - b.index)

    return {
      id: data.spreadsheetId,
      name: data.properties?.title ?? '',
      tabs,
    }
  }
}
