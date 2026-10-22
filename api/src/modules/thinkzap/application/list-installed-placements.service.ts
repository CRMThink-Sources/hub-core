import { env } from '@/config/env'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { fetchPlacementHandlers } from './normalize-placement-get-response'
import { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
export type InstalledPlacement = {
  placement: string
  handler: string
  title: string | null
  isThinkzap: boolean
}

/**
 * `connector.url` entra porque o `SETTING_CONNECTOR` não vem de `placement.bind`:
 * o Bitrix o cria a partir do `PLACEMENT_HANDLER` do `imconnector.register`. Sem
 * ele na lista, o placement do conector aparecia como de outro app.
 */
function isThinkzapHandler(handler: string): boolean {
  const thinkzapHandlers = [
    env.bitrix.placement.url,
    env.bitrix.connector.url,
    env.bitrix.iframeAudio.url,
    env.bitrix.iframeButton.url,
  ].filter(Boolean)

  return thinkzapHandlers.includes(handler)
}

export class ListInstalledPlacementsService {
  async execute(bitrix: BitrixRestClient): Promise<InstalledPlacement[]> {
    const handlers = await fetchPlacementHandlers(bitrix)

    return handlers
      .map(entry => ({
        placement: entry.placement,
        handler: entry.handler,
        title: entry.title,
        isThinkzap: isThinkzapHandler(entry.handler),
      }))
      .sort((a, b) => {
        const byPlacement = a.placement.localeCompare(b.placement)
        if (byPlacement !== 0) return byPlacement
        return a.handler.localeCompare(b.handler)
      })
  }
}

export async function listInstalledPlacements(
  bitrix: BitrixRestClient,
): Promise<InstalledPlacement[]> {
  return new ListInstalledPlacementsService().execute(bitrix)
}
