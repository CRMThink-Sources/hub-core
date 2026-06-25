import pino, { type Bindings, type Logger } from 'pino'
import { env } from '@/config/env'
import { getLogContext } from './log-context'

export type LogApp =
  | 'thinkzap'
  | 'thinkanalise'
  | 'importsheet'
  | 'clicksign'
  | 'shared'
export type WorkerSource = 'z-api' | 'bitrix'

const redactOptions = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'access_token',
    '*.password',
    '*.token',
    '*.access_token',
  ],
  censor: '[REDACTED]',
}

// Erro cru (ex.: AxiosError) carrega `config.params.access_token` e `response.data`
// — serializar o objeto inteiro vaza token no log. Reduz a type/message/stack.
function serializeError(value: unknown): unknown {
  if (value instanceof Error) {
    return { type: value.name, message: value.message, stack: value.stack }
  }
  return value
}

const errorSerializers = {
  err: serializeError,
  error: serializeError,
}

// Em dev (yarn dev no host) manda direto pro Loki além do stdout. Em prod sem
// LOKI_URL fica só stdout (promtail raspa o container). `app`/`source` viram
// label Loki via propsToLabels — alinhado ao pipeline do promtail.
function buildTransport(bindings: Bindings) {
  return pino.transport({
    targets: [
      { target: 'pino/file', options: { destination: 1 }, level: env.logLevel },
      {
        target: 'pino-loki',
        level: env.logLevel,
        options: {
          host: env.lokiUrl,
          labels: {
            service: String(bindings.service ?? 'hubthink-api'),
            env: env.nodeEnv,
          },
          propsToLabels: ['app', 'source'],
          batching: true,
          interval: 5,
        },
      },
    ],
  })
}

function createBaseLogger(bindings: Bindings): Logger {
  const options = {
    level: env.logLevel,
    base: {
      env: env.nodeEnv,
      ...bindings,
    },
    // Injeta o tenant (domain/appId/traceKey) do AsyncLocalStorage em toda linha.
    mixin: () => getLogContext(),
    redact: redactOptions,
    serializers: errorSerializers,
  }
  return env.lokiUrl ? pino(options, buildTransport(bindings)) : pino(options)
}

export function createLogger(bindings: Bindings): Logger {
  return createBaseLogger(bindings)
}

export const apiLogger = createBaseLogger({ service: 'hubthink-api' })

export const workerLogger = createBaseLogger({
  service: 'hubthink-worker',
  app: 'thinkzap',
})

export function createWorkerSourceLogger(source: WorkerSource): Logger {
  return workerLogger.child({ source })
}

export function resolveLogApp(path: string): LogApp {
  if (path.startsWith('/api/thinkzap')) return 'thinkzap'
  if (path.startsWith('/api/audio/upload')) return 'thinkzap'
  if (path.startsWith('/api/thinkanalise')) return 'thinkanalise'
  if (path.startsWith('/api/importsheet')) return 'importsheet'
  if (path.startsWith('/api/clicksign')) return 'clicksign'
  if (
    path.startsWith('/api/webhooks/z-api') ||
    path.startsWith('/api/webhooks/bitrix') ||
    path.startsWith('/api/webhooks/stripe')
  ) {
    return 'thinkzap'
  }
  return 'shared'
}

/** @deprecated Use apiLogger — kept for gradual migration */
export const logger = apiLogger
