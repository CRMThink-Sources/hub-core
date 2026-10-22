import { ensureConnectorRegistration } from '@/modules/thinkzap/application/ensure-connector-registration'
import type { EnsureConnectorRegistrationResult } from '@/modules/thinkzap/application/ensure-connector-registration'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterConnectorForAppOutput = {
  result: EnsureConnectorRegistrationResult
}

export async function registerConnectorForApp(
  appId: string,
): Promise<RegisterConnectorForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await ensureConnectorRegistration(client)

  return { result }
}
