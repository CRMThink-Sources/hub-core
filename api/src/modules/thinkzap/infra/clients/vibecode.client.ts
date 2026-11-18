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

/**
 * Status que a Vibecode devolve por sobrecarga passageira. 401/403/400/404
 * nunca entram: repetir não muda a resposta e só gasta cota.
 */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504])
const MAX_RETRIES = 2
const BACKOFF_MS = [400, 1200]
const RETRY_AFTER_CAP_MS = 5000

const defaultSleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms))

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

  /**
   * `sleep` é injetável para os testes não esperarem o backoff de verdade.
   */
  constructor(
    apiKey: string,
    private readonly sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: { 'X-Api-Key': apiKey },
      timeout: 15000,
    })
  }

  me(): Promise<VibecodeMe> {
    // Validação de chave: sem retentativa, para a tela responder rápido.
    return this.unwrap<VibecodeMe>(() => this.http.get('/me'), 0).then(
      page => page.data,
    )
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

  /**
   * Espera antes da retentativa `attempt` (0-based). Respeita `Retry-After`
   * (segundos) com teto, para um servidor lento não prender a requisição.
   */
  private backoffMs(retryAfter: unknown, attempt: number): number {
    const seconds = Number(retryAfter)
    if (retryAfter != null && retryAfter !== '' && Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds, 0) * 1000, RETRY_AFTER_CAP_MS)
    }
    return BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0
  }

  private async unwrap<T>(
    call: () => Promise<{ data: Envelope<T> }>,
    retries = MAX_RETRIES,
  ): Promise<VibecodePage<T>> {
    for (let attempt = 0; ; attempt++) {
      let res: { data: Envelope<T> }
      try {
        res = await call()
      } catch (err) {
        if (!axios.isAxiosError(err)) {
          throw new VibecodeRequestError('Falha ao chamar a Vibecode')
        }
        const status = err.response?.status
        if (status === 401 || status === 403) {
          throw new VibecodeAuthError(status)
        }
        // Sem resposta (timeout/rede) também é passageiro; com resposta, só
        // os status de sobrecarga.
        const retryable = status === undefined || RETRYABLE_STATUS.has(status)
        if (retryable && attempt < retries) {
          const headers = err.response?.headers as
            | Record<string, unknown>
            | undefined
          await this.sleep(this.backoffMs(headers?.['retry-after'], attempt))
          continue
        }
        throw new VibecodeRequestError(
          `Falha ao chamar a Vibecode (${status ?? 'sem resposta'})`,
          status,
          typeof err.code === 'string' ? err.code : undefined,
        )
      }
      if (!res.data?.success) throw new VibecodeAuthError()
      return { data: res.data.data, meta: res.data.meta }
    }
  }
}
