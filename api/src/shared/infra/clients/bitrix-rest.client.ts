import axios, { type AxiosInstance } from 'axios'

function formatBitrixApiError(
  method: string,
  error: string,
  description?: string,
): string {
  const base = `Bitrix ${method}: ${description ?? error}`
  const lower = `${error} ${description ?? ''}`.toLowerCase()

  if (lower.includes('access_denied') || lower.includes('insufficient_scope')) {
    return `${base}. Verifique scope im no app Bitrix24 e reinstale o app no portal.`
  }

  return base
}

function extractBitrixErrorFromAxios(
  method: string,
  error: unknown,
): Error | null {
  if (!axios.isAxiosError(error) || !error.response?.data) {
    return null
  }

  const data = error.response.data as {
    error?: string
    error_description?: string
  }

  if (!data.error) return null

  return new Error(
    formatBitrixApiError(method, data.error, data.error_description),
  )
}

/**
 * Cliente para chamadas REST do Bitrix24.
 * Usa access_token para autenticação (ex: token do payload de instalação).
 */
export class BitrixRestClient {
  private readonly client: AxiosInstance

  constructor(domain: string, accessToken: string) {
    this.client = axios.create({
      baseURL: `https://${domain}/rest/`,
      params: { auth: accessToken },
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
      const bitrixError = extractBitrixErrorFromAxios(method, error)
      if (bitrixError) throw bitrixError
      throw error
    }
  }
}
