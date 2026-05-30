import https from 'node:https'
import { env } from '@/config/env'

let devBypassAgent: https.Agent | undefined

function createDevBypassAgent(): https.Agent {
  devBypassAgent ??= new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
  })
  return devBypassAgent
}

/**
 * Axios defaults for Bitrix outbound HTTPS.
 *
 * Production: native fetch adapter (undici) — same stack that works in Docker for oauth.bitrix.info.
 * Dev bypass: http adapter + https.Agent with rejectUnauthorized=false (proxy/antivirus).
 */
export function getBitrixAxiosDefaults(): {
  httpsAgent?: https.Agent
  adapter?: 'fetch' | 'http'
} {
  if (!env.bitrix.tlsRejectUnauthorized) {
    return {
      adapter: 'http',
      httpsAgent: createDevBypassAgent(),
    }
  }

  return { adapter: 'fetch' }
}

/** @internal vitest only */
export function resetBitrixHttpsAgentsForTests(): void {
  devBypassAgent = undefined
}

/** @internal vitest only — kept for backward compat in tests */
export function createBitrixHttpsAgent(): https.Agent {
  return createDevBypassAgent()
}
