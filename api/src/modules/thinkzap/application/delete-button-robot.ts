import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'

export type DeleteButtonRobotResult = 'deleted' | 'not_found'

function isRobotNotFoundError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error)

  return (
    message.includes('error_activity_not_found') ||
    message.includes('activity or robot not found')
  )
}

/**
 * Remove **um** robô de botão do portal, pelo `CODE` recebido — mirror de
 * `deleteTemplateRobot`, parametrizado porque os dois robôs de botão só
 * divergem no `CODE`. "Não existe" é sucesso silencioso, mesmo raciocínio: o
 * rollback tem de ser repetível.
 */
async function deleteButtonRobot(
  client: BitrixRestClient,
  code: string,
): Promise<DeleteButtonRobotResult> {
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

export async function deleteButtonRobotOfficial(
  client: BitrixRestClient,
): Promise<DeleteButtonRobotResult> {
  return deleteButtonRobot(client, env.bitrix.buttonRobotOfficial.code)
}

export async function deleteButtonRobotUnofficial(
  client: BitrixRestClient,
): Promise<DeleteButtonRobotResult> {
  return deleteButtonRobot(client, env.bitrix.buttonRobotUnofficial.code)
}
