import https from 'node:https'
import { env } from '@/config/env'

let verifiedAgent: https.Agent | undefined
let devBypassAgent: https.Agent | undefined

/**
 * Shared HTTPS agent for all Bitrix axios clients.
 * Always explicit — avoids axios falling back to a misconfigured global agent in Alpine containers.
 */
export function createBitrixHttpsAgent(): https.Agent {
  if (!env.bitrix.tlsRejectUnauthorized) {
    devBypassAgent ??= new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
    })
    return devBypassAgent
  }

  verifiedAgent ??= new https.Agent({ keepAlive: true })
  return verifiedAgent
}

export function getBitrixAxiosDefaults(): { httpsAgent: https.Agent } {
  return { httpsAgent: createBitrixHttpsAgent() }
}

/** @internal vitest only */
export function resetBitrixHttpsAgentsForTests(): void {
  verifiedAgent = undefined
  devBypassAgent = undefined
}
