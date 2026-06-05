import { deleteSpaPlacements } from '@/modules/thinkzap/application/delete-spa-conversation-widget-placements'
import type { DeleteSpaPlacementsResult } from '@/modules/thinkzap/application/delete-spa-conversation-widget-placements'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteSpaWidgetForAppOutput = {
  result: DeleteSpaPlacementsResult
}

export async function deleteSpaWidgetForApp(
  appId: string,
): Promise<DeleteSpaWidgetForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await deleteSpaPlacements(client)

  return { result }
}
