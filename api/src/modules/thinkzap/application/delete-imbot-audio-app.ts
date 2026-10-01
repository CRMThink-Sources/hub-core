import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

export type DeleteImbotAudioAppResult = 'deleted' | 'not_found'

export async function deleteImbotAudioApp(
  client: BitrixRestClient,
): Promise<DeleteImbotAudioAppResult> {
  const handler = env.bitrix.iframeAudio.url

  if (!handler) {
    return 'not_found'
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
  } catch (error) {
    // Segue `not_found` para não travar a desinstalação.
    logThinkzapError(apiLogger, 'thinkzap.install.placement_unbind_failed', {
      app: 'thinkzap',
      placement: 'IM_TEXTAREA',
      handler,
      err: error,
    })
    return 'not_found'
  }
}
