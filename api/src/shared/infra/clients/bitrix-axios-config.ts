import https from 'node:https'
import { env } from '@/config/env'
import { createBitrixFetchAdapter } from './bitrix-http-request'

let devBypassAgent: https.Agent | undefined

function createDevBypassAgent(): https.Agent {
  devBypassAgent ??= new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
  })
  return devBypassAgent
}

export function getBitrixAxiosDefaults(): {
  httpsAgent?: https.Agent
  adapter: ReturnType<typeof createBitrixFetchAdapter> | 'http'
} {
  if (!env.bitrix.tlsRejectUnauthorized) {
    return {
      adapter: 'http',
      httpsAgent: createDevBypassAgent(),
    }
  }

  return { adapter: createBitrixFetchAdapter() }
}

/** @internal vitest only */
export function resetBitrixHttpsAgentsForTests(): void {
  devBypassAgent = undefined
}
