import axios, { type AxiosInstance } from 'axios'
import type { VibecodeMe } from '@/modules/thinkzap/domain/vibecode-key-policy'

const BASE_URL = 'https://vibecode.bitrix24.com/v1'

/**
 * Chave recusada pela Vibecode (401/403 ou `success: false`). `status` só vem
 * quando a recusa foi HTTP 401/403: `success: false` também cobre erros que
 * não são da chave, e o Insights só pode dar a chave por revogada com certeza.
 */
export class VibecodeAuthError extends Error {
  constructor(readonly status?: number) {
    super(
      'A Vibecode recusou a chave informada (inválida, revogada ou sem permissão).',
    )
    this.name = 'VibecodeAuthError'
  }
}

/** Falha da Vibecode que não é da chave (5xx, rede, timeout). */
export class VibecodeRequestError extends Error {
  /**
   * `status` (HTTP) e `code` (axios, ex.: ECONNABORTED) existem só para
   * diagnóstico: são os únicos detalhes seguros de logar, pois a mensagem crua
   * do axios e os headers carregam a chave.
   */
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'VibecodeRequestError'
  }
}

/** Paginação das listas (`/departments`, `/users`, `/deals/search`). */
export type VibecodeMeta = { hasMore?: boolean }

export type VibecodePage<T> = { data: T; meta?: VibecodeMeta }

type Envelope<T> = { success: boolean; data: T; meta?: VibecodeMeta }

/**
 * Cliente da API Vibecode. Os erros são reconstruídos com mensagem própria:
 * o erro original do axios carrega `config.headers` com a chave, que vazaria
 * para logs se fosse propagado.
 */
export class VibecodeClient {
  private readonly http: AxiosInstance

  constructor(apiKey: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: { 'X-Api-Key': apiKey },
      timeout: 15000,
    })
  }

  me(): Promise<VibecodeMe> {
    return this.get<VibecodeMe>('/me')
  }

  async get<T>(path: string): Promise<T> {
    return (await this.getPage<T>(path)).data
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return (await this.postPage<T>(path, body)).data
  }

  getPage<T>(path: string): Promise<VibecodePage<T>> {
    return this.unwrap<T>(() => this.http.get(path))
  }

  postPage<T>(path: string, body: unknown): Promise<VibecodePage<T>> {
    return this.unwrap<T>(() => this.http.post(path, body))
  }

  private async unwrap<T>(
    call: () => Promise<{ data: Envelope<T> }>,
  ): Promise<VibecodePage<T>> {
    let res: { data: Envelope<T> }
    try {
      res = await call()
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        if (status === 401 || status === 403) {
          throw new VibecodeAuthError(status)
        }
        throw new VibecodeRequestError(
          `Falha ao chamar a Vibecode (${status ?? 'sem resposta'})`,
          status,
          typeof err.code === 'string' ? err.code : undefined,
        )
      }
      throw new VibecodeRequestError('Falha ao chamar a Vibecode')
    }
    if (!res.data?.success) throw new VibecodeAuthError()
    return { data: res.data.data, meta: res.data.meta }
  }
}
