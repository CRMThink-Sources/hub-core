import { ensureThinkzapRobot } from '@/modules/thinkzap/application/ensure-thinkzap-robot'
import type { EnsureThinkzapRobotResult } from '@/modules/thinkzap/application/ensure-thinkzap-robot'
import { syncThinkzapRobotConnectorOptions } from '@/modules/thinkzap/application/sync-robot-connectors'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterBizprocRobotForAppOutput = {
  result: EnsureThinkzapRobotResult
}

export async function registerBizprocRobotForApp(
  appId: string,
): Promise<RegisterBizprocRobotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await ensureThinkzapRobot(client)

  if (result === 'created' || result === 'updated') {
    await syncThinkzapRobotConnectorOptions(appId)
  }

  return { result }
}
