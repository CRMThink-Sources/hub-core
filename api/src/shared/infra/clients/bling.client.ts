import axios from 'axios'
import { env } from '@/config/env'

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export type BlingTokenResult = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  accountId: string | null
}

type BlingErrorBody = {
  error?: { type?: string; message?: string; description?: string }
}

// Rate limit Bling: 3 req/s por CONTA do cliente (não por app) — estouro vira 429
// e reincidência bloqueia o IP por 10min+. Paginação sequencial com pausa, nunca paralelo.
const PAGE_THROTTLE_MS = 350

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeBlingError(err: unknown): Error {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err : new Error(String(err))
  }
  const status = err.response?.status
  const body = err.response?.data as BlingErrorBody | undefined
  const detail = body?.error?.description ?? body?.error?.message

  if (status === 401) return new Error('Invalid credentials')
  if (status === 429) {
    return new Error(
      'Bling limitou o consumo da API (rate limit) — tente novamente em instantes',
    )
  }
  if (status === 403) {
    return new Error(
      `Bling negou o acesso (escopo/módulo indisponível)${detail ? `: ${detail}` : ''}`,
    )
  }
  if (detail) return new Error(`Bling API error: ${detail}`)
  return err
}

export class BlingClient {
  private readonly baseUrl: string

  constructor(readonly accessToken: string) {
    this.baseUrl = env.bling.ApiUrl
  }

  private static basicAuthHeader(): string {
    const clientId = env.bling.ClientId
    const clientSecret = env.bling.ClientSecret
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  }

  private static async postToken(
    params: Record<string, string>,
  ): Promise<BlingTokenResult> {
    const response = await axios.post<TokenResponse>(
      env.bling.TokenUrl,
      new URLSearchParams(params),
      {
        headers: {
          Authorization: BlingClient.basicAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      },
    )
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      accountId: null,
    }
  }

  // Authorization code do Bling expira em 1 minuto — trocar imediatamente no callback
  static async exchangeCode(code: string): Promise<BlingTokenResult> {
    return BlingClient.postToken({ grant_type: 'authorization_code', code })
  }

  static async refresh(refreshToken: string): Promise<BlingTokenResult> {
    return BlingClient.postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  }

  private static readonly MAX_RETRIES = 2
  // teto: callback é rota pública, não pode segurar o socket por um Retry-After alto
  private static readonly MAX_BACKOFF_MS = 5000

  // null = erro não retentável (só 429/5xx transitório; auth é permanente)
  private static retryDelayMs(err: unknown, attempt: number): number | null {
    if (!axios.isAxiosError(err)) return null
    const status = err.response?.status
    if (status !== 429 && status !== 502 && status !== 503 && status !== 504) {
      return null
    }

    const header = err.response?.headers?.['retry-after'] as unknown
    const headerSec =
      typeof header === 'string' || typeof header === 'number'
        ? Number(header)
        : NaN
    const base =
      Number.isFinite(headerSec) && headerSec > 0
        ? headerSec * 1000
        : 2 ** attempt * 1000
    return Math.min(base, BlingClient.MAX_BACKOFF_MS)
  }

  async get<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await axios.get<T>(`${this.baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params,
          timeout: 30000,
        })
        return response.data
      } catch (err) {
        const delay =
          attempt < BlingClient.MAX_RETRIES
            ? BlingClient.retryDelayMs(err, attempt)
            : null
        if (delay === null) throw normalizeBlingError(err)
        await sleep(delay)
      }
    }
  }

  // O refresh já rodou no auth-token.service antes de chegar aqui;
  // 401 nesta chamada = token revogado / app desinstalado na conta Bling.
  async check(): Promise<void> {
    await this.get('/situacoes/modulos')
  }

  async list<T>(
    path: string,
    params: Record<string, unknown> = {},
    maxRows = 1000,
  ): Promise<T[]> {
    const pageSize = 100 // teto do `limite` na API v3
    const rows: T[] = []
    let page = 1

    // Bling não devolve total de páginas: parar na página incompleta
    while (rows.length < maxRows) {
      if (page > 1) await sleep(PAGE_THROTTLE_MS)
      const body = await this.get<{ data?: T[] }>(path, {
        pagina: page,
        limite: pageSize,
        ...params,
      })
      const pageRows = body.data ?? []
      rows.push(...pageRows)
      if (pageRows.length < pageSize) break
      page++
    }

    return rows.slice(0, maxRows)
  }
}
