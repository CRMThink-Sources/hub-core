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

  async getPlacementHandlers(): Promise<
    PlacementHandlerEntry[] | { result?: PlacementHandlerEntry[] }
  > {
    return (await this.callMethod('placement.get', {})) as
      | PlacementHandlerEntry[]
      | { result?: PlacementHandlerEntry[] }
  }
}
