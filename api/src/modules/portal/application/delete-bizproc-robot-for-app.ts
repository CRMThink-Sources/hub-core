import { deleteThinkzapRobot } from '@/modules/thinkzap/application/delete-thinkzap-robot'
import type { DeleteThinkzapRobotResult } from '@/modules/thinkzap/application/delete-thinkzap-robot'
import { deleteTemplateRobot } from '@/modules/thinkzap/application/delete-template-robot'
import type { DeleteTemplateRobotResult } from '@/modules/thinkzap/application/delete-template-robot'
import {
  deleteButtonRobotOfficial,
  deleteButtonRobotUnofficial,
} from '@/modules/thinkzap/application/delete-button-robot'
import type { DeleteButtonRobotResult } from '@/modules/thinkzap/application/delete-button-robot'
import { apiLogger } from '@/shared/infra/logger'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

export type DeleteBizprocRobotForAppOutput = {
  /** Robô de envio livre. Nome mantido: é o que o admin já lê. */
  result: DeleteThinkzapRobotResult
  /** Robô de template. `failed` quando só ele falhou. */
  templateResult: DeleteTemplateRobotResult | 'failed'
  /** Robô de botão da linha oficial. `failed` quando só ele falhou. */
  buttonOfficialResult: DeleteButtonRobotResult | 'failed'
  /** Robô de botão da linha não oficial. `failed` quando só ele falhou. */
  buttonUnofficialResult: DeleteButtonRobotResult | 'failed'
}

/**
 * Remove todos os robôs do portal — o par simétrico do registro.
 *
 * A falha de um não impede os outros, pela mesma razão do registro: são
 * robôs independentes, e um portal onde a remoção de um robô falha não pode
 * ficar sem a remoção dos demais.
 */
export async function deleteBizprocRobotForApp(
  appId: string,
): Promise<DeleteBizprocRobotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)

  const templateResult = await deleteRobotOrFailed(
    client,
    appId,
    deleteTemplateRobot,
    'failed to delete thinkzap template bizproc robot',
  )
  const buttonOfficialResult = await deleteRobotOrFailed(
    client,
    appId,
    deleteButtonRobotOfficial,
    'failed to delete thinkzap official button bizproc robot',
  )
  const buttonUnofficialResult = await deleteRobotOrFailed(
    client,
    appId,
    deleteButtonRobotUnofficial,
    'failed to delete thinkzap unofficial button bizproc robot',
  )

  const result = await deleteThinkzapRobot(client)

  return {
    result,
    templateResult,
    buttonOfficialResult,
    buttonUnofficialResult,
  }
}

async function deleteRobotOrFailed<T>(
  client: BitrixRestClient,
  appId: string,
  del: (client: BitrixRestClient) => Promise<T>,
  logMessage: string,
): Promise<T | 'failed'> {
  try {
    return await del(client)
  } catch (error) {
    apiLogger.error({ app: 'thinkzap', appId, err: error }, logMessage)
    return 'failed'
  }
}
