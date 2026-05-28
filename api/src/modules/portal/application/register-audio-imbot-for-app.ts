import { GetOrCreateThinkzapBot } from '@/modules/thinkzap/application/get-or-create-thinkzap-bot'
import { ensureImbotAudioApp } from '@/modules/thinkzap/application/ensure-imbot-audio-app'
import type { EnsureImbotAudioAppResult } from '@/modules/thinkzap/application/ensure-imbot-audio-app'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterAudioImbotForAppOutput = {
  botId: number
  result: EnsureImbotAudioAppResult
}

export async function registerAudioImbotForApp(
  appId: string,
): Promise<RegisterAudioImbotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)

  const getBot = new GetOrCreateThinkzapBot()
  const botId = await getBot.execute(client)

  if (!botId) {
    throw new Error('ThinkZap bot not found or could not be created')
  }

  const result = await ensureImbotAudioApp(client, botId)

  return { botId, result }
}
