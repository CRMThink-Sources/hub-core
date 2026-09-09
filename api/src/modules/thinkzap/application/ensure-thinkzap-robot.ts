import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { apiLogger } from '@/shared/infra/logger'
import {
  buildThinkzapRobotAddParams,
  buildThinkzapRobotUpdateParams,
} from './build-thinkzap-robot-add-params'
import { isRobotAlreadyExistsError } from './is-robot-already-exists-error'

export type EnsureThinkzapRobotResult = 'created' | 'updated' | 'skipped'

export class EnsureThinkzapRobot {
  async execute(client: BitrixRestClient): Promise<EnsureThinkzapRobotResult> {
    const addParams = buildThinkzapRobotAddParams()

    if (!addParams.HANDLER) {
      return 'skipped'
    }

    apiLogger.info({ code: addParams.CODE }, 'ensuring thinkzap bizproc robot')

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
