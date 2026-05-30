import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import { cleanupLegacyImbotAudioApp } from './cleanup-legacy-imbot-audio-app'

export type DeleteImbotAudioAppResult = 'deleted' | 'not_found'

export async function deleteImbotAudioApp(
  client: BitrixRestClient,
  botIdForLegacyCleanup?: number | null,
): Promise<DeleteImbotAudioAppResult> {
  const handler = env.bitrix.iframeAudio.url

  if (!handler) {
    return 'not_found'
  }

  if (botIdForLegacyCleanup) {
    await cleanupLegacyImbotAudioApp(client, botIdForLegacyCleanup)
  }

  try {
    const result = (await client.callMethod('placement.unbind', {
      PLACEMENT: 'IM_TEXTAREA',
      HANDLER: handler,
    })) as { count?: number } | number | boolean

    const count =
      typeof result === 'object' && result !== null && 'count' in result
        ? Number(result.count)
        : typeof result === 'number'
          ? result
          : result
            ? 1
            : 0

    return count > 0 ? 'deleted' : 'not_found'
  } catch {
    return 'not_found'
  }
}
