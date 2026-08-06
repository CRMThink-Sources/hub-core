import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { callBitrixIdempotent } from '@/shared/infra/clients/call-bitrix-idempotent'
import { logger } from '@/shared/infra/logger'
import { listSpaEntityTypes } from './list-spa-entity-types'
import { buildSpaPlacementBindParams } from './build-spa-placement-bind-params'

export type EnsureSpaPlacements = {
  registered: number
  failed: number
}

export type EnsureSpaPlacementsOptions = {
  /**
   * `true` no fluxo de instalação, que é fail-fast: a primeira SPA que falhar
   * por motivo diferente de "já vinculado" derruba a instalação, nomeando o
   * placement. `false` no sync sob demanda, que percorre todas as SPAs e reporta
   * quantas falharam — ali derrubar a rota por causa de uma SPA seria pior.
   */
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
      // Placement já vinculado conta como registrado: reinstalar num portal já
      // configurado não é falha.
      await callBitrixIdempotent(client, 'placement.bind', params)
      registered++
    } catch (error) {
      if (options.failFast) {
        throw new Error(
          `Falha ao vincular placement da SPA ${String(params.PLACEMENT)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        )
      }

      logger.error(
        { err: error, placement: params.PLACEMENT },
        'failed to bind SPA placement',
      )
      failed++
    }
  }

  return { registered, failed }
}
