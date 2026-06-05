import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { listSpaEntityTypes } from './list-spa-entity-types'
import { buildSpaPlacementBindParams } from './build-spa-placement-bind-params'

export type EnsureSpaPlacements = {
  registered: number
  failed: number
}

export async function ensureSpaPlacements(
  client: BitrixRestClient,
): Promise<EnsureSpaPlacements> {
  const entityTypeIds = await listSpaEntityTypes(client)
  const paramsList = buildSpaPlacementBindParams(entityTypeIds)

  let registered = 0
  let failed = 0

  for (const params of paramsList) {
    try {
      await client.callMethod('placement.bind', params)
      registered++
    } catch (error) {
      console.error(`Failed to bind SPA placement ${params.PLACEMENT}:`, error)
      failed++
    }
  }

  return { registered, failed }
}
