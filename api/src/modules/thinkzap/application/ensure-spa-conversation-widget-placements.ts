import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { callBitrixIdempotent } from '@/shared/infra/clients/call-bitrix-idempotent'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '../errors/catalog'
import { listSpaEntityTypes } from './list-spa-entity-types'
import { buildSpaPlacementBindParams } from './build-spa-placement-bind-params'

export type EnsureSpaPlacements = {
  registered: number
  failed: number
}

export type EnsureSpaPlacementsOptions = {
  /** `true` na instalação (primeira falha derruba); `false` no sync, que só conta falhas. */
  failFast?: boolean
}

export async function ensureSpaPlacements(
  client: BitrixRestClient,
  options: EnsureSpaPlacementsOptions = {},
): Promise<EnsureSpaPlacements> {
  const entityTypeIds = await listSpaEntityTypes(client)
  const paramsList = buildSpaPlacementBindParams(entityTypeIds)

  let registered = 0
  let failed = 0

  for (const params of paramsList) {
    try {
      // Já vinculado conta como registrado: reinstalar não é falha.
      await callBitrixIdempotent(client, 'placement.bind', params)
      registered++
    } catch (error) {
      if (options.failFast) {
        logThinkzapError(
          apiLogger,
          'thinkzap.install.placement_bind_failed',
          {
            app: 'thinkzap',
            placement: params.PLACEMENT,
            err: error instanceof Error ? error.message : String(error),
          },
          { level: 'error' },
        )
        throw new Error(
          `Falha ao vincular placement da SPA ${String(params.PLACEMENT)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        )
      }

      logThinkzapError(
        apiLogger,
        'thinkzap.install.placement_bind_failed',
        { app: 'thinkzap', err: error, placement: params.PLACEMENT },
        { level: 'error', msg: 'failed to bind SPA placement' },
      )
      failed++
    }
  }

  return { registered, failed }
}
