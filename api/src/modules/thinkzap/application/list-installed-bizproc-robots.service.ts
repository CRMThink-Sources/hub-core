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

/**
 * Os quatro robôs que `ThinkzapInstaller` registra: envio livre, template, e os
 * dois de botão. Um `Map` porque cada robô tem `CODE` próprio — comparar contra
 * um único código (como antes) deixava template e botão marcados como "Outro".
 */
function knownThinkzapRobots(): Map<string, string> {
  return new Map([
    [env.bitrix.robot.code, env.bitrix.robot.name],
    [env.bitrix.templateRobot.code, env.bitrix.templateRobot.name],
    [env.bitrix.buttonRobotOfficial.code, env.bitrix.buttonRobotOfficial.name],
    [
      env.bitrix.buttonRobotUnofficial.code,
      env.bitrix.buttonRobotUnofficial.name,
    ],
  ])
}

export class ListInstalledBizprocRobotsService {
  async execute(client: BitrixRestClient): Promise<InstalledBizprocRobot[]> {
    const list = await client.callMethod('bizproc.robot.list', {})
    const codes = parseBizprocRobotListResponse(list)
    const known = knownThinkzapRobots()

    return codes
      .map(code => {
        const name = known.get(code) ?? null

        return {
          code,
          name,
          isThinkzap: name !== null,
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
