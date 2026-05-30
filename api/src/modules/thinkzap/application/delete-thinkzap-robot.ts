import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'

export type DeleteThinkzapRobotResult = 'deleted' | 'not_found'

function isRobotNotFoundError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error)

  return (
    message.includes('error_activity_not_found') ||
    message.includes('activity or robot not found')
  )
}

export async function deleteThinkzapRobot(
  client: BitrixRestClient,
): Promise<DeleteThinkzapRobotResult> {
  const code = env.bitrix.robot.code

  if (!code) {
    return 'not_found'
  }

  try {
    const result = await client.callMethod('bizproc.robot.delete', {
      CODE: code,
    })

    return result ? 'deleted' : 'not_found'
  } catch (error) {
    if (isRobotNotFoundError(error)) {
      return 'not_found'
    }

    throw error
  }
}
