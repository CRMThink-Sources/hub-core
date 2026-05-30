import { deleteConversationWidgetPlacements } from '@/modules/thinkzap/application/delete-conversation-widget-placements'
import type { DeleteConversationWidgetPlacementsResult } from '@/modules/thinkzap/application/delete-conversation-widget-placements'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteConversationWidgetForAppOutput = {
  result: DeleteConversationWidgetPlacementsResult
}

export async function deleteConversationWidgetForApp(
  appId: string,
): Promise<DeleteConversationWidgetForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await deleteConversationWidgetPlacements(client)

  return { result }
}
