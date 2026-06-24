import axios, { type AxiosInstance } from 'axios'
import { getBitrixAxiosDefaults } from './bitrix-axios-config'
import {
  formatBitrixApiError,
  wrapBitrixRequestError,
} from './bitrix-http-errors'
import { normalizeBitrixDomain } from './normalize-bitrix-domain'
import type { PlacementHandlerEntry } from '@/modules/thinkzap/application/normalize-placement-get-response'

/**
 * Cliente para chamadas REST do Bitrix24.
 * Usa access_token para autenticação (ex: token do payload de instalação).
 */
export class BitrixRestClient {
  private readonly client: AxiosInstance

  constructor(domain: string, accessToken: string) {
    this.client = axios.create({
      baseURL: `https://${normalizeBitrixDomain(domain)}/rest/`,
      params: { auth: accessToken },
      ...getBitrixAxiosDefaults(),
    })
  }

  /**
   * Chama um método da REST API do Bitrix.
   * Ex: callMethod("event.bind", { event: "ONIMCONNECTORMESSAGEADD", ... })
   */
  async callMethod(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      const response = await this.client.post(`/${method}`, params)
      const data = response.data as {
        error?: string
        error_description?: string
        result?: unknown
      }
      if (data.error) {
        throw new Error(
          formatBitrixApiError(method, data.error, data.error_description),
        )
      }
      return data.result ?? data
    } catch (error) {
      throw wrapBitrixRequestError(method, error)
    }
  }

  /**
   * Executa várias chamadas REST num único request (`batch`, máx. 50 por lote).
   * Recebe um mapa `chave → { method, params }` e devolve `chave → result`.
   * Params só com valores escalares (suficiente p/ `*.get?id=`).
   */
  async callBatch(
    commands: Record<
      string,
      { method: string; params: Record<string, string | number | boolean> }
    >,
  ): Promise<Record<string, unknown>> {
    const cmd: Record<string, string> = {}
    for (const [key, { method, params }] of Object.entries(commands)) {
      const query = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (v != null) query.append(k, String(v))
      }
      const qs = query.toString()
      cmd[key] = qs ? `${method}?${qs}` : method
    }

    const res = (await this.callMethod('batch', { halt: 0, cmd })) as {
      result?: Record<string, unknown>
    }
    return res?.result ?? {}
  }

  async getPlacementHandlers(): Promise<
    PlacementHandlerEntry[] | { result?: PlacementHandlerEntry[] }
  > {
    return (await this.callMethod('placement.get', {})) as
      | PlacementHandlerEntry[]
      | { result?: PlacementHandlerEntry[] }
  }
}
