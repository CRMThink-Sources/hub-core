import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { apiLogger } from '@/shared/infra/logger'
import {
  buildTemplateRobotAddParams,
  buildTemplateRobotUpdateParams,
} from './build-template-robot-params'
import { isRobotAlreadyExistsError } from './is-robot-already-exists-error'

export type EnsureTemplateRobotResult = 'created' | 'updated' | 'skipped'

/**
 * Garante o robô de **template** no portal, sem tocar no robô de envio livre.
 *
 * Idempotente por construção: `add` e, no "já existe", `update`. Reinstalar passa a
 * corrigir propriedades e placement em vez de deixar o robô com a definição da versão
 * anterior — importante aqui porque a tela de configuração é ligada justamente por
 * `USE_PLACEMENT`, que só chega ao portal por um destes dois caminhos.
 */
export class EnsureTemplateRobot {
  async execute(client: BitrixRestClient): Promise<EnsureTemplateRobotResult> {
    const addParams = buildTemplateRobotAddParams()

    // Sem handler o robô ficaria no portal apontando para lugar nenhum: a automação
    // seria configurável e o disparo morreria em 404. Melhor não existir.
    if (!addParams.HANDLER) {
      return 'skipped'
    }

    apiLogger.info(
      { code: addParams.CODE, placement: Boolean(addParams.USE_PLACEMENT) },
      'ensuring thinkzap template bizproc robot',
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
      buildTemplateRobotUpdateParams(),
    )

    if (!updated) {
      return 'skipped'
    }

    return 'updated'
  }
}

export async function ensureTemplateRobot(
  client: BitrixRestClient,
): Promise<EnsureTemplateRobotResult> {
  return new EnsureTemplateRobot().execute(client)
}
