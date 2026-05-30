import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildAudioImTextareaPlacementBindParams } from './build-audio-im-textarea-placement-params'
import { cleanupLegacyImbotAudioApp } from './cleanup-legacy-imbot-audio-app'

export type EnsureImbotAudioAppResult = 'created' | 'updated' | 'skipped'

type PlacementHandlerEntry = {
  placement?: string
  handler?: string
  PLACEMENT?: string
  HANDLER?: string
}

function normalizeHandlerEntry(entry: PlacementHandlerEntry) {
  return {
    placement: entry.placement ?? entry.PLACEMENT ?? '',
    handler: entry.handler ?? entry.HANDLER ?? '',
  }
}

async function hasExistingAudioPlacement(
  client: BitrixRestClient,
  handler: string,
): Promise<boolean> {
  try {
    const list = (await client.callMethod('placement.get', {})) as
      | PlacementHandlerEntry[]
      | { result?: PlacementHandlerEntry[] }

    const handlers = Array.isArray(list)
      ? list
      : Array.isArray(list?.result)
        ? list.result
        : []

    return handlers.some(entry => {
      const { placement, handler: h } = normalizeHandlerEntry(entry)
      return placement === 'IM_TEXTAREA' && h === handler
    })
  } catch {
    return false
  }
}

export class EnsureImbotAudioApp {
  async execute(
    client: BitrixRestClient,
    options?: { botIdForLegacyCleanup?: number | null },
  ): Promise<EnsureImbotAudioAppResult> {
    const params = buildAudioImTextareaPlacementBindParams()

    if (!params.HANDLER) {
      return 'skipped'
    }

    const botId = options?.botIdForLegacyCleanup
    if (botId) {
      await cleanupLegacyImbotAudioApp(client, botId)
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
  botIdForLegacyCleanup?: number | null,
): Promise<EnsureImbotAudioAppResult> {
  return new EnsureImbotAudioApp().execute(client, {
    botIdForLegacyCleanup,
  })
}
