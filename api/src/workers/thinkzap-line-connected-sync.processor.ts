import type { LineItemByRemoteIdFinder } from '@/modules/thinkzap/domain/ports/line-item-by-remote-id-finder.port'
import type { SyncLineConnectedField } from '@/modules/thinkzap/application/sync-line-connected-field'
import {
  AppendJobLog,
  noopJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import { apiLogger } from '@/shared/infra/logger'
import type { ThinkzapLineConnectedSyncJob } from '@/queue/thinkzap-line-connected-sync.queue'

export type LineConnectedSyncDeps = {
  finder: LineItemByRemoteIdFinder
  sync: Pick<SyncLineConnectedField, 'execute'>
  /** `connected` de `GET /instances/{id}/token/{token}/status`. Lança em falha. */
  readZApiConnected: (instanceId: string, token: string) => Promise<boolean>
}

export type LineConnectedSyncOutcome =
  | { outcome: 'item-not-found' }
  | { outcome: 'synced'; written: number; unchanged: number }

/**
 * Grava `UF_CRM_93_CONNECTED` no(s) item(ns) da linha do evento.
 *
 * **Z-API relê o status ao vivo** com a credencial do item, e só cai no tipo do
 * evento se a leitura falhar. Isso torna o resultado independente da ordem dos jobs:
 * uma desconexão seguida de reconexão, com o job da desconexão atrasado por retry,
 * terminaria gravando `Não` numa linha conectada se o tipo do evento decidisse.
 *
 * **HubMessage usa o tipo do evento:** não há status por canal, e o agregado por
 * WABA pode misturar canais.
 *
 * Item não encontrado é terminal (retentar não faz o item aparecer). Falha no
 * Bitrix propaga para o BullMQ retentar.
 */
export async function processLineConnectedSyncJob(
  job: ThinkzapLineConnectedSyncJob,
  deps: LineConnectedSyncDeps,
  context: { appendJobLog?: AppendJobLog } = {},
): Promise<LineConnectedSyncOutcome> {
  const appendJobLog = context.appendJobLog ?? noopJobLog
  const logContext = {
    app: 'thinkzap',
    provider: job.provider,
    event: job.event,
    remoteId: job.remoteId,
  }

  const targets =
    job.provider === 'ZAPI'
      ? await deps.finder.findLiveByZApiInstanceId(job.remoteId)
      : await deps.finder.findLiveByHubMessageChannelId(job.remoteId)

  if (targets.length === 0) {
    await appendJobLog(
      'Nenhum item vivo com este identificador; campo não gravado',
    )
    apiLogger.warn(
      logContext,
      'Evento de conexão sem item de linha na SPA; campo Conectado não gravado',
    )
    return { outcome: 'item-not-found' }
  }

  if (targets.length > 1) {
    apiLogger.warn(
      { ...logContext, itemIds: targets.map(target => target.id) },
      'Mais de um item vivo com o mesmo identificador remoto; gravando em todos',
    )
  }

  const fromEvent = job.event === 'connected'
  let written = 0
  let unchanged = 0

  for (const target of targets) {
    let connected = fromEvent

    if (job.provider === 'ZAPI' && target.zApiInstanceToken) {
      try {
        connected = await deps.readZApiConnected(
          job.remoteId,
          target.zApiInstanceToken,
        )
      } catch (error) {
        apiLogger.warn(
          { ...logContext, itemId: target.id, error },
          'Status ao vivo da Z-API indisponível; usando o tipo do evento',
        )
      }
    }

    const outcome = await deps.sync.execute({
      itemId: target.id,
      current: target.connected,
      connected,
    })

    if (outcome === 'written') written++
    else unchanged++

    await appendJobLog(
      `Item ${target.id}: ${connected ? 'Sim' : 'Não'} (${outcome === 'written' ? 'gravado' : 'inalterado'})`,
    )
  }

  apiLogger.info(
    { ...logContext, written, unchanged },
    'Campo Conectado da linha sincronizado',
  )

  return { outcome: 'synced', written, unchanged }
}
