import pino, { type Bindings, type Logger } from 'pino'
import { env } from '@/config/env'

export type LogApp = 'thinkzap' | 'thinkanalise' | 'shared'
export type WorkerSource = 'z-api' | 'bitrix'

const redactOptions = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'password',
    'token',
    'accessToken',
    'refreshToken',
    '*.password',
    '*.token',
  ],
  censor: '[REDACTED]',
}

function createBaseLogger(bindings: Bindings): Logger {
  return pino({
    level: env.logLevel,
    base: {
      env: env.nodeEnv,
      ...bindings,
    },
    redact: redactOptions,
  })
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
