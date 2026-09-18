import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import {
  EnsureButtonRobot,
  EnsureButtonRobotResult,
} from './ensure-button-robot'

/**
 * Garante o robô de botão da linha **não oficial** (Z-API): botões
 * REPLY/URL/CALL (sem misturar REPLY com os outros dois no mesmo envio).
 */
export async function ensureButtonRobotUnofficial(
  client: BitrixRestClient,
): Promise<EnsureButtonRobotResult> {
  return new EnsureButtonRobot(
    env.bitrix.buttonRobotUnofficial,
    'Envia uma mensagem com botões de ação (resposta rápida, link ou ligação) pelo Z-API',
  ).execute(client)
}
