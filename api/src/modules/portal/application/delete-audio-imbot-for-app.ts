import { deleteImbotAudioApp } from '@/modules/thinkzap/application/delete-imbot-audio-app'
import type { DeleteImbotAudioAppResult } from '@/modules/thinkzap/application/delete-imbot-audio-app'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteAudioImbotForAppOutput = {
  result: DeleteImbotAudioAppResult
}

export async function deleteAudioImbotForApp(
  appId: string,
): Promise<DeleteAudioImbotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await deleteImbotAudioApp(client)

  return { result }
}
