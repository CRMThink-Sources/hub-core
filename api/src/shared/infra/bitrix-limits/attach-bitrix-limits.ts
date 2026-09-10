import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { type Logger } from 'pino'
import { createLogger } from '@/shared/infra/logger'
import { BitrixMethodPausedError, getBitrixLimits } from './bitrix-limits.port'
import {
  MAX_QUERY_LIMIT_RETRIES,
  classifyLimitError,
  retryDelayMs,
} from './limit-errors'
import { pauseUntilMs, readOperating } from './operating-budget'

/**
 * Logger resolvido na primeira necessidade, nao no carregamento do modulo.
 *
 * Este modulo e importado pelo cliente Bitrix, que por sua vez e importado por
 * praticamente toda suite — varias delas mockam `@/shared/infra/logger` com um
 * subconjunto dos exports. Criar o logger no topo faria o import quebrar nesses
 * testes por um logger que aquele caminho nem usa.
 */
let cachedLog: Logger | undefined
const log = (): Logger =>
  (cachedLog ??= createLogger({
    service: 'hubthink-shared',
    source: 'bitrix-limits',
  }))

/**
 * Aplica os limites do Bitrix na instância axios.
 *
 * Interceptor e não wrapper por método: `BitrixClient` tem uma dezena de métodos que
 * fazem `client.post` direto (`sendMessage`, `activateConnector`, ...), e envolver um
 * por um deixaria buracos exatamente no caminho mais quente. A instância axios é o
 * único ponto por onde toda chamada passa.
 */

type RetryState = { bitrixLimitRetries?: number }

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/** `/imbot.v2.Bot.list` → `imbot.v2.Bot.list`. Vazio para webhook sem path. */
export function methodFromUrl(url: string | undefined): string {
  if (!url) return 'unknown'
  return url.split('?')[0]!.replace(/^\/+/, '') || 'unknown'
}

export function attachBitrixLimits(
  client: AxiosInstance,
  domain: string | undefined,
): AxiosInstance {
  /**
   * Sem domínio não há por quem controlar: webhook de entrada não identifica portal, e
   * inventar uma chave global misturaria baldes de instalações diferentes.
   */
  if (!domain) return client

  /**
   * Instância sem `interceptors` é axios mockado em teste unitário. Devolver intacta
   * mantém esses testes exercitando o que eles medem — formatação de erro, TLS — sem
   * precisar conhecer o controle de limites.
   */
  if (typeof client.interceptors?.request?.use !== 'function') return client

  client.interceptors.request.use(async config => {
    const method = methodFromUrl(config.url)
    const context = { domain, method }
    const limits = getBitrixLimits()

    const pausedUntil = await limits.pausedUntil(context)
    if (pausedUntil) {
      /**
       * Falha rápido em vez de mandar: o método está bloqueado por orçamento de
       * execução, e a chamada só serviria para renovar o bloqueio.
       */
      throw new BitrixMethodPausedError(method, domain, pausedUntil)
    }

    await limits.acquire(context)

    return config
  })

  client.interceptors.response.use(
    async response => {
      const method = methodFromUrl(response.config.url)
      const body = response.data as { time?: Record<string, unknown> }
      const reading = readOperating(body?.time)

      if (reading) {
        await getBitrixLimits().observeOperating(
          { domain, method },
          reading.operating,
          reading.resetAtMs,
        )
      }

      return response
    },
    async (error: unknown) => {
      const hit = classifyLimitError(error)
      if (!hit || !axios.isAxiosError(error) || !error.config) throw error

      const config = error.config as typeof error.config & RetryState
      const method = methodFromUrl(config.url)
      const context = { domain, method }

      if (hit.kind === 'operation-time') {
        /**
         * Aqui backoff não serve: o orçamento é de tempo de execução do método e só
         * volta quando a cesta de minuto vence. Pausa e desiste.
         */
        const body = (error.response?.data ?? {}) as {
          time?: Record<string, unknown>
        }
        const untilMs = pauseUntilMs(readOperating(body?.time), Date.now())

        await getBitrixLimits().pauseMethod(context, untilMs)

        log().error(
          {
            domain,
            method,
            pausedUntil: new Date(untilMs).toISOString(),
            bitrixOperationTimeLimit: true,
          },
          'Bitrix bloqueou o método por tempo de execução acumulado',
        )

        throw new BitrixMethodPausedError(method, domain, untilMs)
      }

      const attempt = (config.bitrixLimitRetries ?? 0) + 1
      if (attempt > MAX_QUERY_LIMIT_RETRIES) {
        log().error(
          { domain, method, attempt, bitrixQueryLimitExhausted: true },
          'Limite de intensidade do Bitrix persistiu após as retentativas',
        )
        throw error
      }

      const delay = retryDelayMs(attempt)
      config.bitrixLimitRetries = attempt

      log().warn(
        { domain, method, attempt, delayMs: delay, bitrixQueryLimit: true },
        'Bitrix recusou por intensidade — recuando antes de repetir',
      )

      await sleep(delay)
      return client.request(config)
    },
  )

  return client
}
