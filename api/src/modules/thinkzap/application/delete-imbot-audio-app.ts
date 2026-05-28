import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildImbotAudioAppParams } from './build-imbot-audio-app-params'

export type DeleteImbotAudioAppResult = 'deleted' | 'not_found'

export async function deleteImbotAudioApp(
  client: BitrixRestClient,
  botId: number,
): Promise<DeleteImbotAudioAppResult> {
  const appId = Number(
    await client.callMethod(
      'imbot.app.register',
      buildImbotAudioAppParams(botId),
    ),
  )

  if (!appId) {
    return 'not_found'
  }

  await client.callMethod('imbot.app.unregister', { APP_ID: appId })

  return 'deleted'
}
