import { deleteImbotAudioApp } from '@/modules/thinkzap/application/delete-imbot-audio-app'
import type { DeleteImbotAudioAppResult } from '@/modules/thinkzap/application/delete-imbot-audio-app'
import { findThinkzapBotId } from '@/modules/thinkzap/application/get-or-create-thinkzap-bot'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteAudioImbotForAppOutput = {
  result: DeleteImbotAudioAppResult
}

export async function deleteAudioImbotForApp(
  appId: string,
): Promise<DeleteAudioImbotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)

  const botId = await findThinkzapBotId(client)
  const result = await deleteImbotAudioApp(client, botId)

  return { result }
}
