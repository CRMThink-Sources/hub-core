import axios, {
  type AxiosAdapter,
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

/** Native Node fetch — same stack that works in Docker for oauth.bitrix.info. */
export async function bitrixFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, init)
}

function appendAxiosHeader(
  headers: Headers,
  key: string,
  value: unknown,
): void {
  if (value == null) return

  if (Array.isArray(value)) {
    for (const item of value) {
      appendAxiosHeader(headers, key, item)
    }
    return
  }

  if (typeof value === 'string') {
    headers.set(key, value)
    return
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    headers.set(key, String(value))
  }
}

async function readResponseBody(
  response: Response,
  responseType?: InternalAxiosRequestConfig['responseType'],
): Promise<unknown> {
  if (responseType === 'arraybuffer') {
    return response.arrayBuffer()
  }

  const text = await response.text()
  if (!text) return null

  if (responseType === 'text') {
    return text
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * Axios adapter that delegates to native fetch (not axios built-in fetch adapter).
 * Keeps axios API for BitrixDisk/BiConnector while using the TLS stack that works in prod.
 */
export function createBitrixFetchAdapter(): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const url = axios.getUri(config)
    const method = (config.method ?? 'get').toUpperCase()

    const headers = new Headers()
    if (config.headers) {
      for (const [key, value] of Object.entries(
        config.headers as Record<string, unknown>,
      )) {
        appendAxiosHeader(headers, key, value)
      }
    }

    let body: BodyInit | undefined
    if (method !== 'GET' && method !== 'HEAD' && config.data != null) {
      if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        body = config.data
      } else if (typeof config.data === 'string') {
        body = config.data
      } else {
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json')
        }
        body = JSON.stringify(config.data)
      }
    }

    try {
      const response = await bitrixFetch(url, { method, headers, body })
      const data = await readResponseBody(response, config.responseType)

      const axiosResponse: AxiosResponse = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        config,
        request: undefined,
      }

      if (!response.ok) {
        throw new AxiosError(
          `Request failed with status code ${response.status}`,
          AxiosError.ERR_BAD_RESPONSE,
          config,
          undefined,
          axiosResponse,
        )
      }

      return axiosResponse
    } catch (error) {
      if (error instanceof AxiosError) {
        throw error
      }

      const networkError = new AxiosError(
        error instanceof Error ? error.message : String(error),
        AxiosError.ERR_NETWORK,
        config,
      )
      if (error instanceof Error) {
        networkError.cause = error
      }
      throw networkError
    }
  }
}
