import https from 'node:https'
import { env } from '@/config/env'

export function createBitrixHttpsAgent(): https.Agent | undefined {
  if (env.bitrix.tlsRejectUnauthorized) {
    return undefined
  }

  return new https.Agent({ rejectUnauthorized: false })
}

export function getBitrixAxiosDefaults(): { httpsAgent?: https.Agent } {
  const httpsAgent = createBitrixHttpsAgent()
  return httpsAgent ? { httpsAgent } : {}
}
