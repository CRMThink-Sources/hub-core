import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildAudioImTextareaPlacementBindParams } from './build-audio-im-textarea-placement-params'
import { fetchPlacementHandlers } from './normalize-placement-get-response'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

export type EnsureImbotAudioAppResult = 'created' | 'updated' | 'skipped'

async function hasExistingAudioPlacement(
  client: BitrixRestClient,
  handler: string,
): Promise<boolean> {
  try {
    const handlers = await fetchPlacementHandlers(client)

    return handlers.some(
      entry => entry.placement === 'IM_TEXTAREA' && entry.handler === handler,
    )
  } catch {
    return false
  }
}

export class EnsureImbotAudioApp {
  async execute(client: BitrixRestClient): Promise<EnsureImbotAudioAppResult> {
    const params = buildAudioImTextareaPlacementBindParams()

    if (!params.HANDLER) {
      return 'skipped'
    }

    const existed = await hasExistingAudioPlacement(client, params.HANDLER)

    const bound = await client.callMethod('placement.bind', params)

    if (!bound) {
      return 'skipped'
    }

    return existed ? 'updated' : 'created'
  }
}

export async function ensureImbotAudioApp(
  client: BitrixRestClient,
): Promise<EnsureImbotAudioAppResult> {
  return new EnsureImbotAudioApp().execute(client)
}
