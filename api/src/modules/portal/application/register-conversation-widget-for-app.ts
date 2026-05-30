import { ensureConversationWidgetPlacements } from '@/modules/thinkzap/application/ensure-conversation-widget-placements'
import type { EnsureConversationWidgetPlacementsResult } from '@/modules/thinkzap/application/ensure-conversation-widget-placements'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterConversationWidgetForAppOutput = {
  result: EnsureConversationWidgetPlacementsResult
}

export async function registerConversationWidgetForApp(
  appId: string,
): Promise<RegisterConversationWidgetForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await ensureConversationWidgetPlacements(client)

  return { result }
}
