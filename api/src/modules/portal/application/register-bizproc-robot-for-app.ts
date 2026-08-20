import { ensureThinkzapRobot } from '@/modules/thinkzap/application/ensure-thinkzap-robot'
import type { EnsureThinkzapRobotResult } from '@/modules/thinkzap/application/ensure-thinkzap-robot'
import { ensureTemplateRobot } from '@/modules/thinkzap/application/ensure-template-robot'
import type { EnsureTemplateRobotResult } from '@/modules/thinkzap/application/ensure-template-robot'
import { syncThinkzapRobotConnectorOptions } from '@/modules/thinkzap/application/sync-robot-connectors'
import { apiLogger } from '@/shared/infra/logger'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterBizprocRobotForAppOutput = {
  /** Robô de envio livre. Nome mantido: é o que o admin já lê. */
  result: EnsureThinkzapRobotResult
  /** Robô de envio de template. `failed` quando só ele falhou. */
  templateResult: EnsureTemplateRobotResult | 'failed'
}

/**
 * Garante os **dois** robôs no portal.
 *
 * É por aqui que um portal já instalado passa a oferecer o robô de template — sem
 * este passo, só quem reinstalasse o app receberia o robô novo.
 *
 * A falha de um não impede o outro: os robôs são independentes, e um portal sem
 * permissão para o robô novo não pode perder a correção de definição do robô antigo
 * (nem o contrário). A falha do robô de envio livre continua propagando, porque é ela
 * que o admin já usa para saber que o registro não passou; a do robô de template
 * aparece como `templateResult: 'failed'`, com o motivo no log.
 */
export async function registerBizprocRobotForApp(
  appId: string,
): Promise<RegisterBizprocRobotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)

  let templateResult: EnsureTemplateRobotResult | 'failed'
  try {
    templateResult = await ensureTemplateRobot(client)
  } catch (error) {
    apiLogger.error(
      { app: 'thinkzap', appId, err: error },
      'failed to ensure thinkzap template bizproc robot',
    )
    templateResult = 'failed'
  }

  const result = await ensureThinkzapRobot(client)

  // Só o robô de envio livre depende de opções sincronizadas: o de template lê as
  // linhas pela tela, direto da API.
  if (result === 'created' || result === 'updated') {
    await syncThinkzapRobotConnectorOptions(appId)
  }

  return { result, templateResult }
}
