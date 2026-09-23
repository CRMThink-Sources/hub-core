import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildButtonImTextareaPlacementBindParams } from './build-button-im-textarea-placement-params'
import { fetchPlacementHandlers } from './normalize-placement-get-response'

export type EnsureImbotButtonAppResult = 'created' | 'updated' | 'skipped'

async function hasExistingButtonPlacement(
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

export class EnsureImbotButtonApp {
  async execute(client: BitrixRestClient): Promise<EnsureImbotButtonAppResult> {
    const params = buildButtonImTextareaPlacementBindParams()

    if (!params.HANDLER) {
      return 'skipped'
    }

    const existed = await hasExistingButtonPlacement(client, params.HANDLER)

    const bound = await client.callMethod('placement.bind', params)

    if (!bound) {
      return 'skipped'
    }

    return existed ? 'updated' : 'created'
  }
}

export async function ensureImbotButtonApp(
  client: BitrixRestClient,
): Promise<EnsureImbotButtonAppResult> {
  return new EnsureImbotButtonApp().execute(client)
}
