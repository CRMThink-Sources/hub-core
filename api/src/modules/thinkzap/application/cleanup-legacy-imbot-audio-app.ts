import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildImbotAudioAppParams } from './build-imbot-audio-app-params'

/**
 * Remove imbot.app widget legado (pre placement.bind IM_TEXTAREA).
 */
export async function cleanupLegacyImbotAudioApp(
  client: BitrixRestClient,
  botId: number,
): Promise<void> {
  try {
    const appId = Number(
      await client.callMethod(
        'imbot.app.register',
        buildImbotAudioAppParams(botId),
      ),
    )

    if (!appId) return

    await client.callMethod('imbot.app.unregister', { APP_ID: appId })
  } catch {
    // Portal pode nao ter app imbot legado
  }
}
