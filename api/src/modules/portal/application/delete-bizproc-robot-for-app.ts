import { deleteThinkzapRobot } from '@/modules/thinkzap/application/delete-thinkzap-robot'
import type { DeleteThinkzapRobotResult } from '@/modules/thinkzap/application/delete-thinkzap-robot'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteBizprocRobotForAppOutput = {
  result: DeleteThinkzapRobotResult
}

export async function deleteBizprocRobotForApp(
  appId: string,
): Promise<DeleteBizprocRobotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await deleteThinkzapRobot(client)

  return { result }
}
