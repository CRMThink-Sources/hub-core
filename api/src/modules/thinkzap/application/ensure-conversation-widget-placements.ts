import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildCrmDetailPlacementBindParams } from './build-crm-detail-placement-bind-params'
import { fetchPlacementHandlers } from './normalize-placement-get-response'

export type EnsureConversationWidgetPlacementsResult =
  | 'created'
  | 'updated'
  | 'skipped'

async function hasExistingConversationPlacement(
  client: BitrixRestClient,
  placement: string,
  handler: string,
): Promise<boolean> {
  try {
    const handlers = await fetchPlacementHandlers(client)

    return handlers.some(
      entry => entry.placement === placement && entry.handler === handler,
    )
  } catch {
    return false
  }
}

export class EnsureConversationWidgetPlacements {
  async execute(
    client: BitrixRestClient,
  ): Promise<EnsureConversationWidgetPlacementsResult> {
    const paramsList = buildCrmDetailPlacementBindParams()

    if (!paramsList[0]?.HANDLER) {
      return 'skipped'
    }

    let anyExisted = false
    let anyBound = false

    for (const params of paramsList) {
      const existed = await hasExistingConversationPlacement(
        client,
        params.PLACEMENT,
        params.HANDLER,
      )

      if (existed) {
        anyExisted = true
      }

      const bound = await client.callMethod('placement.bind', params)

      if (bound) {
        anyBound = true
      }
    }

    if (!anyBound) {
      return 'skipped'
    }

    return anyExisted ? 'updated' : 'created'
  }
}

export async function ensureConversationWidgetPlacements(
  client: BitrixRestClient,
): Promise<EnsureConversationWidgetPlacementsResult> {
  return new EnsureConversationWidgetPlacements().execute(client)
}
