import { ensureSpaPlacements } from '@/modules/thinkzap/application/ensure-spa-conversation-widget-placements'
import type { EnsureSpaPlacements } from '@/modules/thinkzap/application/ensure-spa-conversation-widget-placements'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterSpaWidgetForAppOutput = {
  result: EnsureSpaPlacements
}

export async function registerSpaWidgetForApp(
  appId: string,
): Promise<RegisterSpaWidgetForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await ensureSpaPlacements(client)

  return { result }
}
