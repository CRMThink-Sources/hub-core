import { logger } from '@/shared/infra/logger'
import type { BitrixMethodCaller } from './call-bitrix-idempotent'

export type EventBinding = {
  event: string
  handler: string
  authType?: string
  offline?: number
}

type BoundEvent = { event?: string; handler?: string }

/**
 * Reconcilia os handlers de evento do app com o estado atual do portal.
 *
 * `event.bind` erra com "Handler already binded" ao reinstalar, e tratar isso
 * como sucesso deixaria um buraco: quando a URL do webhook muda entre deploys,
 * o Bitrix **não** erra — ele adiciona um segundo binding, e os dois passam a
 * disparar. Ler `event.get` antes resolve os dois casos: já ligado no handler
 * certo não faz nada, ligado em outro handler é religado.
 */
export async function ensureEventBindings(
  client: BitrixMethodCaller,
  bindings: EventBinding[],
): Promise<void> {
  const bound = await listBoundEvents(client)

  for (const binding of bindings) {
    const event = binding.event.toUpperCase()
    const current = bound.filter(e => (e.event ?? '').toUpperCase() === event)

    if (current.some(e => e.handler === binding.handler)) {
      logger.info(
        { event: binding.event, handler: binding.handler },
        'event handler already bound, nothing to update',
      )
      continue
    }

    // Handler diferente do desejado: desliga o antigo antes de ligar o novo,
    // senão o portal fica com dois handlers do mesmo evento disparando.
    for (const stale of current) {
      if (!stale.handler) continue

      logger.info(
        { event: binding.event, from: stale.handler, to: binding.handler },
        'rebinding event handler to new URL',
      )

      await client.callMethod('event.unbind', {
        event: binding.event,
        handler: stale.handler,
      })
    }

    await client.callMethod('event.bind', {
      event: binding.event,
      handler: binding.handler,
      auth_type: binding.authType ?? '0',
      offline: binding.offline ?? 0,
    })
  }
}

async function listBoundEvents(
  client: BitrixMethodCaller,
): Promise<BoundEvent[]> {
  const res = (await client.callMethod('event.get', {})) as
    | BoundEvent[]
    | { result?: BoundEvent[] }

  if (Array.isArray(res)) return res

  return Array.isArray(res?.result) ? res.result : []
}
