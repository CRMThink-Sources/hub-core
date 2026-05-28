import { GetOrCreateThinkzapBot } from '@/modules/thinkzap/application/get-or-create-thinkzap-bot'
import { deleteImbotAudioApp } from '@/modules/thinkzap/application/delete-imbot-audio-app'
import type { DeleteImbotAudioAppResult } from '@/modules/thinkzap/application/delete-imbot-audio-app'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteAudioImbotForAppOutput = {
  botId: number
  result: DeleteImbotAudioAppResult
}

export async function deleteAudioImbotForApp(
  appId: string,
): Promise<DeleteAudioImbotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)

  const getBot = new GetOrCreateThinkzapBot()
  const botId = await getBot.execute(client)
  console.log('botId', botId)
  if (!botId) {
    throw new Error('ThinkZap bot not found or could not be created')
  }

  const result = await deleteImbotAudioApp(client, botId)

  return { botId, result }
}
