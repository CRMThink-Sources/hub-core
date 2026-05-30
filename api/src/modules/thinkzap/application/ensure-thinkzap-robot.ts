import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import {
  buildThinkzapRobotAddParams,
  buildThinkzapRobotUpdateParams,
} from './build-thinkzap-robot-add-params'

export type EnsureThinkzapRobotResult = 'created' | 'updated' | 'skipped'

function isRobotAlreadyExistsError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error)

  return (
    message.includes('already') ||
    message.includes('duplicate') ||
    message.includes('validation_failure')
  )
}

export class EnsureThinkzapRobot {
  async execute(client: BitrixRestClient): Promise<EnsureThinkzapRobotResult> {
    const addParams = buildThinkzapRobotAddParams()

    if (!addParams.HANDLER) {
      return 'skipped'
    }

    try {
      const added = await client.callMethod('bizproc.robot.add', addParams)

      if (!added) {
        return 'skipped'
      }

      return 'created'
    } catch (error) {
      if (!isRobotAlreadyExistsError(error)) {
        throw error
      }
    }

    const updateParams = buildThinkzapRobotUpdateParams()
    const updated = await client.callMethod(
      'bizproc.robot.update',
      updateParams,
    )

    if (!updated) {
      return 'skipped'
    }

    return 'updated'
  }
}

export async function ensureThinkzapRobot(
  client: BitrixRestClient,
): Promise<EnsureThinkzapRobotResult> {
  return new EnsureThinkzapRobot().execute(client)
}
