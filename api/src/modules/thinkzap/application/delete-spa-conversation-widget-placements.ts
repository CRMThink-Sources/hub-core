import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { listSpaEntityTypes } from './list-spa-entity-types'

export type DeleteSpaPlacementsResult = {
  deleted: number
  failed: number
}

export async function deleteSpaPlacements(
  client: BitrixRestClient,
): Promise<DeleteSpaPlacementsResult> {
  const handler = env.bitrix.placement.url

  if (!handler) {
    return { deleted: 0, failed: 0 }
  }

  const entityTypeIds = await listSpaEntityTypes(client)

  let deleted = 0
  let failed = 0

  for (const id of entityTypeIds) {
    try {
      await client.callMethod('placement.unbind', {
        PLACEMENT: `CRM_DYNAMIC_${id}_DETAIL_TAB`,
        HANDLER: handler,
      })
      deleted++
    } catch (error) {
      logThinkzapError(apiLogger, 'thinkzap.install.placement_unbind_failed', {
        app: 'thinkzap',
        err: error,
        placement: `CRM_DYNAMIC_${id}_DETAIL_TAB`,
      })
      failed++
    }
  }

  return { deleted, failed }
}
