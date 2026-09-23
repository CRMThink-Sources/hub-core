import { ensureImbotButtonApp } from '@/modules/thinkzap/application/ensure-imbot-button-app'
import type { EnsureImbotButtonAppResult } from '@/modules/thinkzap/application/ensure-imbot-button-app'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterButtonImbotForAppOutput = {
  result: EnsureImbotButtonAppResult
}

export async function registerButtonImbotForApp(
  appId: string,
): Promise<RegisterButtonImbotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await ensureImbotButtonApp(client)

  return { result }
}
