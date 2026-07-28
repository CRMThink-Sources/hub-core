import axios from 'axios'
import { env } from '@/config/env'
import {
  SpreadsheetDetails,
  SpreadsheetHeader,
} from '@/modules/importsheet/domain/entities/spreadsheet'
import {
  GoogleSheetsGateway,
  SpreadsheetRow,
} from '@/modules/importsheet/domain/gateways/google-sheets.gateway'
import { GoogleUnavailableError } from '@/modules/importsheet/domain/errors/google-unavailable.error'
import { importsheetError } from '@/modules/importsheet/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

const SHEETS_TIMEOUT_MS = 10000

function isNetworkFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response) return false
  apiLogger.warn(
    { app: 'importsheet', code: error.code },
    'Google Sheets indisponível (falha de rede)',
  )
  return true
}

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

type ValuesGetResponse = {
  values?: string[][]
}

function columnLetter(index: number): string {
  let n = index
  let letter = ''
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letter
}

function headerRange(tabTitle: string): string {
  const escaped = tabTitle.replace(/'/g, "''")
  return `'${escaped}'!1:1`
}

function rowsRange(tabTitle: string, fromRow: number, limit: number): string {
  const escaped = tabTitle.replace(/'/g, "''")
  const toRow = fromRow + limit - 1
  return `'${escaped}'!A${fromRow}:ZZ${toRow}`
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
            includeGridData: false,
            fields:
              'spreadsheetId,properties.title,sheets.properties(sheetId,title,index,gridProperties(rowCount,columnCount))',
          },
          timeout: SHEETS_TIMEOUT_MS,
        },
      )
      return this.toDetails(response.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 404 || status === 403) return null
      }
      if (isNetworkFailure(error)) throw new GoogleUnavailableError()
      throw error
    }
  }

  async getHeaderRow(
    accessToken: string,
    spreadsheetId: string,
    tabTitle: string,
  ): Promise<SpreadsheetHeader | null> {
    const range = encodeURIComponent(headerRange(tabTitle))
    try {
      const response = await axios.get<ValuesGetResponse>(
        `${env.google.sheetsApiUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { majorDimension: 'ROWS', fields: 'values' },
          timeout: SHEETS_TIMEOUT_MS,
        },
      )
      const row = response.data.values?.[0] ?? []
      const columns = row.map((label, index) => ({
        index,
        letter: columnLetter(index),
        label: label ?? '',
      }))
      return { spreadsheetId, tabTitle, columns }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 404 || status === 403) return null
        // 400 = range/aba inválida.
        if (status === 400) {
          throw importsheetError('importsheet.sheet.range_invalid', error)
        }
      }
      if (isNetworkFailure(error)) throw new GoogleUnavailableError()
      throw error
    }
  }

  async getRows(
    accessToken: string,
    spreadsheetId: string,
    tabTitle: string,
    fromRow: number,
    limit: number,
  ): Promise<SpreadsheetRow[] | null> {
    const range = encodeURIComponent(rowsRange(tabTitle, fromRow, limit))
    try {
      const response = await axios.get<ValuesGetResponse>(
        `${env.google.sheetsApiUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { majorDimension: 'ROWS', fields: 'values' },
          timeout: SHEETS_TIMEOUT_MS,
        },
      )
      const rows = response.data.values ?? []
      // A API omite linhas vazias do FIM, mas pode devolver linhas curtas;
      // o número absoluto é fromRow + índice no array retornado.
      return rows.map((values, i) => ({
        row: fromRow + i,
        values: values ?? [],
      }))
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status
        if (status === 404 || status === 403) return null
        if (status === 400) {
          throw importsheetError('importsheet.sheet.range_invalid', error)
        }
      }
      if (isNetworkFailure(error)) throw new GoogleUnavailableError()
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
