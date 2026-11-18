import axios, { type AxiosInstance } from 'axios'
import type { VibecodeMe } from '@/modules/thinkzap/domain/vibecode-key-policy'

const BASE_URL = 'https://vibecode.bitrix24.com/v1'

/** Chave recusada pela Vibecode (401/403 ou `success: false`). */
export class VibecodeAuthError extends Error {
  constructor() {
    super(
      'A Vibecode recusou a chave informada (inválida, revogada ou sem permissão).',
    )
    this.name = 'VibecodeAuthError'
  }
}

type Envelope<T> = { success: boolean; data: T }

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

  get<T>(path: string): Promise<T> {
    return this.unwrap<T>(() => this.http.get(path))
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.unwrap<T>(() => this.http.post(path, body))
  }

  private async unwrap<T>(
    call: () => Promise<{ data: Envelope<T> }>,
  ): Promise<T> {
    let res: { data: Envelope<T> }
    try {
      res = await call()
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        if (status === 401 || status === 403) throw new VibecodeAuthError()
        throw new Error(
          `Falha ao chamar a Vibecode (${status ?? 'sem resposta'})`,
        )
      }
      throw new Error('Falha ao chamar a Vibecode')
    }
    if (!res.data?.success) throw new VibecodeAuthError()
    return res.data.data
  }
}
