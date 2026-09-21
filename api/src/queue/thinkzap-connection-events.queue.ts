import { Queue } from 'bullmq'
import { bullBaseOptions } from './redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export const THINKZAP_CONNECTION_EVENTS = 'thinkzap-connection-events'

/**
 * Fila do aviso de conexão/desconexão de linha Z-API — separada da `thinkzap-inbound`
 * de propósito: o webhook só precisa responder rápido, e resolver domínio/app/
 * destinatários + chamar `im.notify.system.add` é lento o bastante (e opcional o
 * bastante) pra não segurar a resposta ao provider.
 *
 * `ConnectedCallback` traz `phone`/`lid`/`isBusiness`; `DisconnectedCallback` traz só
 * `error` (ver `ZApiDisconectedEvent`/`ZApiConnectedEvent` em
 * `shared/infra/handlers/z-api/z-api.d.ts`) — por isso os campos opcionais aqui.
 */
export type ThinkzapConnectionEventJob = {
  type: 'connected' | 'disconnected'
  instanceId: string
  momment: number
  error?: string
  phone?: string
}

export const thinkzapConnectionEventsQueue =
  new Queue<ThinkzapConnectionEventJob>(
    THINKZAP_CONNECTION_EVENTS,
    bullBaseOptions,
  )

/**
 * `jobId` determinístico por `(instanceId, type, momment)`: o mesmo evento reentregue
 * pelo provider (retry de webhook) colapsa no mesmo job em vez de disparar dois avisos.
 */
export function connectionEventJobId(
  instanceId: string,
  type: ThinkzapConnectionEventJob['type'],
  momment: number,
): string {
  return `connection-event-${instanceId}-${type}-${momment}`
}

export async function enqueueThinkzapConnectionEvent(
  job: ThinkzapConnectionEventJob,
) {
  const createdJob = await thinkzapConnectionEventsQueue.add(
    'process-connection-event',
    job,
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      jobId: connectionEventJobId(job.instanceId, job.type, job.momment),
    },
  )

  apiLogger.info(
    {
      app: 'thinkzap',
      queue: THINKZAP_CONNECTION_EVENTS,
      jobId: createdJob.id,
      type: job.type,
      instanceId: job.instanceId,
    },
    'Connection event job enqueued',
  )

  return createdJob
}
