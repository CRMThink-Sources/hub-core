import { deleteThinkzapRobot } from '@/modules/thinkzap/application/delete-thinkzap-robot'
import type { DeleteThinkzapRobotResult } from '@/modules/thinkzap/application/delete-thinkzap-robot'
import { deleteTemplateRobot } from '@/modules/thinkzap/application/delete-template-robot'
import type { DeleteTemplateRobotResult } from '@/modules/thinkzap/application/delete-template-robot'
import { apiLogger } from '@/shared/infra/logger'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteBizprocRobotForAppOutput = {
  /** Robô de envio livre. Nome mantido: é o que o admin já lê. */
  result: DeleteThinkzapRobotResult
  /** Robô de template. `failed` quando só ele falhou. */
  templateResult: DeleteTemplateRobotResult | 'failed'
}

/**
 * Remove os **dois** robôs do portal — o par simétrico do registro.
 *
 * A falha de um não impede o outro, pela mesma razão do registro: são robôs
 * independentes, e um portal onde a remoção do robô novo falha não pode ficar sem a
 * remoção do antigo.
 */
export async function deleteBizprocRobotForApp(
  appId: string,
): Promise<DeleteBizprocRobotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)

  let templateResult: DeleteTemplateRobotResult | 'failed'
  try {
    templateResult = await deleteTemplateRobot(client)
  } catch (error) {
    apiLogger.error(
      { app: 'thinkzap', appId, err: error },
      'failed to delete thinkzap template bizproc robot',
    )
    templateResult = 'failed'
  }

  const result = await deleteThinkzapRobot(client)

  return { result, templateResult }
}
