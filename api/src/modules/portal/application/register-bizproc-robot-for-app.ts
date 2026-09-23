import { ensureThinkzapRobot } from '@/modules/thinkzap/application/ensure-thinkzap-robot'
import type { EnsureThinkzapRobotResult } from '@/modules/thinkzap/application/ensure-thinkzap-robot'
import { ensureTemplateRobot } from '@/modules/thinkzap/application/ensure-template-robot'
import type { EnsureTemplateRobotResult } from '@/modules/thinkzap/application/ensure-template-robot'
import { ensureButtonRobotOfficial } from '@/modules/thinkzap/application/ensure-button-robot-official'
import { ensureButtonRobotUnofficial } from '@/modules/thinkzap/application/ensure-button-robot-unofficial'
import type { EnsureButtonRobotResult } from '@/modules/thinkzap/application/ensure-button-robot'
import { syncThinkzapRobotConnectorOptions } from '@/modules/thinkzap/application/sync-robot-connectors'
import { apiLogger } from '@/shared/infra/logger'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

export type RegisterBizprocRobotForAppOutput = {
  /** Robô de envio livre. Nome mantido: é o que o admin já lê. */
  result: EnsureThinkzapRobotResult
  /** Robô de envio de template. `failed` quando só ele falhou. */
  templateResult: EnsureTemplateRobotResult | 'failed'
  /** Robô de botão da linha oficial. `failed` quando só ele falhou. */
  buttonOfficialResult: EnsureButtonRobotResult | 'failed'
  /** Robô de botão da linha não oficial. `failed` quando só ele falhou. */
  buttonUnofficialResult: EnsureButtonRobotResult | 'failed'
}

/**
 * Garante todos os robôs no portal: envio livre, template, e os dois de botão.
 *
 * É por aqui que um portal já instalado passa a oferecer um robô novo — sem
 * este passo, só quem reinstalasse o app receberia o robô.
 *
 * Cada robô é independente: a falha de um não impede os outros — um portal sem
 * permissão para um robô novo não pode perder a correção de definição de um robô
 * que já usa (nem o contrário). A falha do robô de envio livre continua
 * propagando, porque é ela que o admin já usa para saber que o registro não
 * passou; a dos demais aparece como `'failed'` no campo correspondente, com o
 * motivo no log.
 */
export async function registerBizprocRobotForApp(
  appId: string,
): Promise<RegisterBizprocRobotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)

  const templateResult = await ensureRobotOrFailed(
    client,
    appId,
    ensureTemplateRobot,
    'failed to ensure thinkzap template bizproc robot',
  )
  const buttonOfficialResult = await ensureRobotOrFailed(
    client,
    appId,
    ensureButtonRobotOfficial,
    'failed to ensure thinkzap official button bizproc robot',
  )
  const buttonUnofficialResult = await ensureRobotOrFailed(
    client,
    appId,
    ensureButtonRobotUnofficial,
    'failed to ensure thinkzap unofficial button bizproc robot',
  )

  const result = await ensureThinkzapRobot(client)

  // Só o robô de envio livre depende de opções sincronizadas: os demais leem as
  // linhas pela tela, direto da API.
  if (result === 'created' || result === 'updated') {
    await syncThinkzapRobotConnectorOptions(appId)
  }

  return {
    result,
    templateResult,
    buttonOfficialResult,
    buttonUnofficialResult,
  }
}

/**
 * Garante um robô e traduz qualquer falha em `'failed'`, sem propagar — é o que
 * torna os robôs independentes uns dos outros nesta função.
 */
async function ensureRobotOrFailed<T>(
  client: BitrixRestClient,
  appId: string,
  ensure: (client: BitrixRestClient) => Promise<T>,
  logMessage: string,
): Promise<T | 'failed'> {
  try {
    return await ensure(client)
  } catch (error) {
    apiLogger.error({ app: 'thinkzap', appId, err: error }, logMessage)
    return 'failed'
  }
}
