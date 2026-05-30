import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

export type PlacementHandlerEntry = {
  placement?: string
  handler?: string
  title?: string
  PLACEMENT?: string
  HANDLER?: string
  TITLE?: string
}

export type NormalizedPlacementHandler = {
  placement: string
  handler: string
  title: string | null
}

export type PlacementGetClient = BitrixClient | BitrixRestClient

export function normalizeHandlerEntry(
  entry: PlacementHandlerEntry,
): NormalizedPlacementHandler {
  return {
    placement: entry.placement ?? entry.PLACEMENT ?? '',
    handler: entry.handler ?? entry.HANDLER ?? '',
    title: entry.title ?? entry.TITLE ?? null,
  }
}

function parsePlacementGetResponse(
  list: PlacementHandlerEntry[] | { result?: PlacementHandlerEntry[] },
): PlacementHandlerEntry[] {
  if (Array.isArray(list)) {
    return list
  }

  if (Array.isArray(list?.result)) {
    return list.result
  }

  return []
}

export async function fetchPlacementHandlers(
  bitrix: BitrixRestClient,
): Promise<NormalizedPlacementHandler[]> {
  const list = await bitrix.getPlacementHandlers()

  return parsePlacementGetResponse(list).map(normalizeHandlerEntry)
}
