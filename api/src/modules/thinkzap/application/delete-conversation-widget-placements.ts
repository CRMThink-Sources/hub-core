import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'
import { CRM_DETAIL_PLACEMENTS } from './build-crm-detail-placement-bind-params'

export type DeleteConversationWidgetPlacementsResult = 'deleted' | 'not_found'

function parseUnbindCount(result: unknown): number {
  if (typeof result === 'object' && result !== null && 'count' in result) {
    return Number((result as { count?: number }).count)
  }

  if (typeof result === 'number') {
    return result
  }

  return result ? 1 : 0
}

export async function deleteConversationWidgetPlacements(
  client: BitrixRestClient,
): Promise<DeleteConversationWidgetPlacementsResult> {
  const handler = env.bitrix.placement.url

  if (!handler) {
    return 'not_found'
  }

  let totalRemoved = 0

  for (const placement of CRM_DETAIL_PLACEMENTS) {
    try {
      const result = await client.callMethod('placement.unbind', {
        PLACEMENT: placement,
        HANDLER: handler,
      })

      totalRemoved += parseUnbindCount(result)
    } catch (error) {
      logThinkzapError(apiLogger, 'thinkzap.install.placement_unbind_failed', {
        app: 'thinkzap',
        placement,
        err: error,
      })
    }
  }

  return totalRemoved > 0 ? 'deleted' : 'not_found'
}
