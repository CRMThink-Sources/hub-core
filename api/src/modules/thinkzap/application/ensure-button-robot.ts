import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { apiLogger } from '@/shared/infra/logger'
import {
  ButtonRobotEnvConfig,
  buildButtonRobotAddParams,
  buildButtonRobotUpdateParams,
} from './build-button-robot-params'
import { isRobotAlreadyExistsError } from './is-robot-already-exists-error'

export type EnsureButtonRobotResult = 'created' | 'updated' | 'skipped'

/**
 * Garante **um** robô de botão no portal — oficial ou não oficial, conforme o
 * `config` recebido. Mirror de `EnsureTemplateRobot`, parametrizado porque os
 * dois robôs de botão só divergem em `CODE`/`NAME`/`HANDLER`/`PLACEMENT_HANDLER`
 * (o `config` de cada um) e na descrição — as `PROPERTIES` são idênticas.
 *
 * Idempotente por construção: `add` e, no "já existe", `update`.
 */
export class EnsureButtonRobot {
  constructor(
    private readonly config: ButtonRobotEnvConfig,
    private readonly description: string,
  ) {}

  async execute(client: BitrixRestClient): Promise<EnsureButtonRobotResult> {
    const addParams = buildButtonRobotAddParams(this.config, this.description)

    // Sem handler o robô ficaria no portal apontando para lugar nenhum: a automação
    // seria configurável e o disparo morreria em 404. Melhor não existir.
    if (!addParams.HANDLER) {
      return 'skipped'
    }

    apiLogger.info(
      { code: addParams.CODE, placement: Boolean(addParams.USE_PLACEMENT) },
      'ensuring thinkzap button bizproc robot',
    )

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

    const updated = await client.callMethod(
      'bizproc.robot.update',
      buildButtonRobotUpdateParams(this.config, this.description),
    )

    if (!updated) {
      return 'skipped'
    }

    return 'updated'
  }
}
