import { listInstalledPlacements } from '@/modules/thinkzap/application/list-installed-placements.service'
import type { InstalledPlacement } from '@/modules/thinkzap/application/list-installed-placements.service'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'
export type ListPlacementsForAppOutput = {
  placements: InstalledPlacement[]
}

export async function listPlacementsForApp(
  appId: string,
): Promise<ListPlacementsForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const placements = await listInstalledPlacements(client)

  return { placements }
}
