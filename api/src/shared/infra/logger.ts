import pino from 'pino'
import { env } from '@/config/env'

export const logger = pino({
  level: env.logLevel,
  base: {
    service: 'hubthink-api',
    env: env.nodeEnv,
  },
  redact: {
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
  },
})
