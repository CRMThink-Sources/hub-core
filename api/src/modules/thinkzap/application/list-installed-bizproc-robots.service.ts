import { env } from '@/config/env'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

export type InstalledBizprocRobot = {
  code: string
  name: string | null
  isThinkzap: boolean
}

function parseBizprocRobotListResponse(result: unknown): string[] {
  if (Array.isArray(result)) {
    return result.filter((entry): entry is string => typeof entry === 'string')
  }

  if (
    typeof result === 'object' &&
    result !== null &&
    Array.isArray((result as { result?: unknown }).result)
  ) {
    return (result as { result: unknown[] }).result.filter(
      (entry): entry is string => typeof entry === 'string',
    )
  }

  return []
}

export class ListInstalledBizprocRobotsService {
  async execute(client: BitrixRestClient): Promise<InstalledBizprocRobot[]> {
    const list = await client.callMethod('bizproc.robot.list', {})
    const codes = parseBizprocRobotListResponse(list)
    const thinkzapCode = env.bitrix.robot.code
    const thinkzapName = env.bitrix.robot.name

    return codes
      .map(code => {
        const isThinkzap = code === thinkzapCode

        return {
          code,
          name: isThinkzap ? thinkzapName : null,
          isThinkzap,
        }
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }
}

export async function listInstalledBizprocRobots(
  client: BitrixRestClient,
): Promise<InstalledBizprocRobot[]> {
  return new ListInstalledBizprocRobotsService().execute(client)
}
