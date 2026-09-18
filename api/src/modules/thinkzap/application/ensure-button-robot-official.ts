import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import {
  EnsureButtonRobot,
  EnsureButtonRobotResult,
} from './ensure-button-robot'

/** Garante o robô de botão da linha **oficial** (HubMessage): botões URL/REPLY. */
export async function ensureButtonRobotOfficial(
  client: BitrixRestClient,
): Promise<EnsureButtonRobotResult> {
  return new EnsureButtonRobot(
    env.bitrix.buttonRobotOfficial,
    'Envia uma mensagem com botões de ação (link/resposta rápida) pelo WhatsApp Oficial',
  ).execute(client)
}
