import { ensureImbotAudioApp } from '@/modules/thinkzap/application/ensure-imbot-audio-app'
import type { EnsureImbotAudioAppResult } from '@/modules/thinkzap/application/ensure-imbot-audio-app'
import { findThinkzapBotId } from '@/modules/thinkzap/application/get-or-create-thinkzap-bot'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type RegisterAudioImbotForAppOutput = {
  result: EnsureImbotAudioAppResult
}

export async function registerAudioImbotForApp(
  appId: string,
): Promise<RegisterAudioImbotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)

  const botId = await findThinkzapBotId(client)
  const result = await ensureImbotAudioApp(client, botId)

  return { result }
}
