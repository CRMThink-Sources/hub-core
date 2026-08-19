import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'

export type DeleteTemplateRobotResult = 'deleted' | 'not_found'

function isRobotNotFoundError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error)

  return (
    message.includes('error_activity_not_found') ||
    message.includes('activity or robot not found')
  )
}

/**
 * Remove **só** o robô de template do portal.
 *
 * É o caminho de rollback da mudança: o robô de envio livre e o envio do widget não
 * são tocados, então desfazer é local. Intenções já gravadas no outbox seguem sendo
 * entregues pelo worker — remover o robô impede disparos novos, não cancela os que já
 * foram aceitos.
 *
 * "Não existe" é sucesso silencioso, como em `deleteThinkzapRobot`: rollback tem de
 * ser repetível, e um portal onde o robô nunca chegou a ser registrado não é erro.
 */
export async function deleteTemplateRobot(
  client: BitrixRestClient,
): Promise<DeleteTemplateRobotResult> {
  const code = env.bitrix.templateRobot.code

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
