/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import {
  buildImbotAudioAppParams,
  buildImbotAudioAppUpdateParams,
} from './build-imbot-audio-app-params'

export type EnsureImbotAudioAppResult = 'created' | 'updated' | 'skipped'

export class EnsureImbotAudioApp {
  async execute(
    client: BitrixRestClient,
    botId: number,
  ): Promise<EnsureImbotAudioAppResult> {
    const registerParams = buildImbotAudioAppParams(botId)
    const appId = Number(
      await client.callMethod('imbot.app.register', registerParams),
    )

    if (!appId) {
      return 'skipped'
    }
    console.log('appId', appId)
    await client.callMethod(
      'imbot.app.update',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      buildImbotAudioAppUpdateParams(appId),
    )

    return 'updated'
  }
}

export async function ensureImbotAudioApp(
  client: BitrixRestClient,
  botId: number,
): Promise<EnsureImbotAudioAppResult> {
  return new EnsureImbotAudioApp().execute(client, botId)
}
