import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildImbotAudioAppParams } from './build-imbot-audio-app-params'

export type EnsureImbotAudioAppResult = 'created' | 'updated' | 'skipped'

export class EnsureImbotAudioApp {
  async execute(
    client: BitrixRestClient,
    botId: number,
  ): Promise<EnsureImbotAudioAppResult> {
    const params = buildImbotAudioAppParams(botId)
    const appId = Number(await client.callMethod('imbot.app.register', params))

    if (!appId) {
      return 'skipped'
    }

    return 'updated'
  }
}

export async function ensureImbotAudioApp(
  client: BitrixRestClient,
  botId: number,
): Promise<EnsureImbotAudioAppResult> {
  return new EnsureImbotAudioApp().execute(client, botId)
}
