import { logger } from '@/shared/infra/logger'
import type { BitrixMethodCaller } from './call-bitrix-idempotent'

export type PlacementBindParams = Record<string, unknown> & {
  PLACEMENT: string
  HANDLER: string
}

/** `placement.get` responde ora em maiúsculas, ora em minúsculas. */
type PlacementEntry = {
  placement?: string
  handler?: string
  PLACEMENT?: string
  HANDLER?: string
}

type NormalizedPlacement = { placement: string; handler: string }

/**
 * Reconcilia placements com o estado atual do portal, pelo mesmo motivo dos
 * eventos: `placement.bind` erra quando o par (placement, handler) já existe, e
 * quando o handler muda ele **adiciona** em vez de substituir — o portal fica
 * com duas abas iguais apontando para URLs diferentes.
 *
 * Só desliga handlers que este app conhece (os passados em `ownedHandlers`):
 * um placement do mesmo tipo registrado por outro app não é nosso para remover.
 */
export async function ensurePlacementBindings(
  client: BitrixMethodCaller,
  bindings: PlacementBindParams[],
  ownedHandlers: string[],
): Promise<void> {
  const installed = await listPlacements(client)
  const owned = new Set(ownedHandlers.filter(Boolean))

  for (const binding of bindings) {
    const current = installed.filter(
      entry => entry.placement === binding.PLACEMENT,
    )

    if (current.some(entry => entry.handler === binding.HANDLER)) {
      logger.info(
        { placement: binding.PLACEMENT },
        'placement already bound, nothing to update',
      )
      continue
    }

    for (const stale of current) {
      if (!owned.has(stale.handler)) continue

      logger.info(
        {
          placement: binding.PLACEMENT,
          from: stale.handler,
          to: binding.HANDLER,
        },
        'rebinding placement to new handler',
      )

      await client.callMethod('placement.unbind', {
        PLACEMENT: binding.PLACEMENT,
        HANDLER: stale.handler,
      })
    }

    await client.callMethod('placement.bind', binding)
  }
}

async function listPlacements(
  client: BitrixMethodCaller,
): Promise<NormalizedPlacement[]> {
  const res = (await client.callMethod('placement.get', {})) as
    | PlacementEntry[]
    | { result?: PlacementEntry[] }

  const list = Array.isArray(res) ? res : (res?.result ?? [])

  return list.map(entry => ({
    placement: entry.placement ?? entry.PLACEMENT ?? '',
    handler: entry.handler ?? entry.HANDLER ?? '',
  }))
}
