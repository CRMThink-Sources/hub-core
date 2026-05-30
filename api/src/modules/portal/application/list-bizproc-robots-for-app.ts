import { listInstalledBizprocRobots } from '@/modules/thinkzap/application/list-installed-bizproc-robots.service'
import type { InstalledBizprocRobot } from '@/modules/thinkzap/application/list-installed-bizproc-robots.service'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type ListBizprocRobotsForAppOutput = {
  robots: InstalledBizprocRobot[]
}

export async function listBizprocRobotsForApp(
  appId: string,
): Promise<ListBizprocRobotsForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const robots = await listInstalledBizprocRobots(client)

  return { robots }
}
