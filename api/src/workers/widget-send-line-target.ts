import type { AplicationContext } from '@/modules/application/application/get-aplication-context'
import type { DispatchLineTarget } from '@/modules/thinkzap/application/dispatch-widget-outbox-message'
import { findItemInContext } from '@/modules/thinkzap/application/helpers/resolve-line-by-subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { LineNotFoundError } from '@/modules/thinkzap/domain/errors/line-not-found.error'
import type { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'

/** O motivo gravado na row quando a linha de fato não está mais na instalação. */
export const LINE_NOT_FOUND_REASON = 'Linha não encontrada na instalação'

/**
 * `not-found` é a linha que **de fato** não existe: o contexto foi lido e o item não
 * está nele (ou está sem provider). `unavailable` é a leitura do contexto que falhou —
 * Bitrix fora, rede, rate limit. Tratar os dois igual foi o que perdeu mensagens:
 * instabilidade virava "linha não existe", estado terminal, sem retentativa.
 */
export type LineTargetResolution =
  | { kind: 'found'; line: DispatchLineTarget }
  | { kind: 'not-found' }
  | { kind: 'unavailable'; error: unknown }

export type LineTargetRow = {
  id: string
  domainId: string
  appCode: string
  subscriptionItemId: string
}

export type LoadAplicationContext = (input: {
  domainId: string
  appCode: string
}) => Promise<AplicationContext>

export async function resolveLineTarget(
  row: LineTargetRow,
  loadContext: LoadAplicationContext,
): Promise<LineTargetResolution> {
  let context: AplicationContext
  try {
    context = await loadContext({
      domainId: row.domainId,
      appCode: row.appCode,
    })
  } catch (error) {
    return { kind: 'unavailable', error }
  }

  let item: ReturnType<typeof findItemInContext>
  try {
    item = findItemInContext(context, row.subscriptionItemId)
  } catch (error) {
    if (error instanceof LineNotFoundError) return { kind: 'not-found' }
    return { kind: 'unavailable', error }
  }

  const line = { settings: item.settings, appId: context.aplication.id }

  if (item.metadata.provider === 'ZAPI') {
    return {
      kind: 'found',
      line: {
        ...line,
        provider: ConnectorProvider.ZAPI,
        instanceId: item.metadata.zApiInstanceId,
        zApiToken: item.metadata.zApiInstanceToken,
      },
    }
  }

  if (item.metadata.provider === 'HUBMESSAGE') {
    return {
      kind: 'found',
      line: {
        ...line,
        provider: ConnectorProvider.HUBMESSAGE,
        instanceId: item.metadata.hubmessageChannelId,
        channelId: item.metadata.hubmessageChannelId,
      },
    }
  }

  return { kind: 'not-found' }
}

export type SettleUnresolvedLineDeps = {
  markFailed(id: string, reason: string): Promise<void>
  notifyFailed(): Promise<void>
  appendJobLog: AppendJobLog
  onUnavailable(error: unknown, willRetry: boolean): void
}

/** Erro relançado para o BullMQ retentar; a row continua `PENDING`, sem `claim`. */
export class LineLookupUnavailableError extends Error {
  constructor(readonly original: unknown) {
    super(`Falha temporária ao consultar a linha: ${summarizeError(original)}`)
    this.name = 'LineLookupUnavailableError'
  }
}

/**
 * Decide o destino de uma intenção cuja linha não foi resolvida.
 *
 * - `not-found`: terminal na hora — retentar não traz a linha de volta.
 * - `unavailable` antes da última tentativa: **lança**, para o BullMQ retentar com
 *   backoff. A row não foi reivindicada, então segue `PENDING` e reivindicável.
 * - `unavailable` na última tentativa: terminal com o motivo real. Sem isso a row
 *   ficaria `PENDING` sem job, parada até a varredura do sequenciador.
 */
export async function settleUnresolvedLine(
  row: LineTargetRow,
  resolution: Exclude<LineTargetResolution, { kind: 'found' }>,
  isLastAttempt: boolean,
  deps: SettleUnresolvedLineDeps,
): Promise<'done'> {
  if (resolution.kind === 'not-found') {
    await deps.appendJobLog(
      `Linha ${row.subscriptionItemId} não está mais na instalação. ` +
        'Estado terminal (FAILED) — retentativa não resolveria. Operador avisado na timeline.',
    )
    await deps.markFailed(row.id, LINE_NOT_FOUND_REASON)
    await deps.notifyFailed()
    return 'done'
  }

  const unavailable = new LineLookupUnavailableError(resolution.error)
  deps.onUnavailable(resolution.error, !isLastAttempt)

  if (!isLastAttempt) {
    await deps.appendJobLog(
      `${unavailable.message}. Não é a última tentativa — job relançado para o BullMQ ` +
        'retentar com backoff; a intenção continua PENDING.',
    )
    throw unavailable
  }

  await deps.appendJobLog(
    `${unavailable.message}. Última tentativa — estado terminal (FAILED). Operador avisado na timeline.`,
  )
  await deps.markFailed(row.id, unavailable.message)
  await deps.notifyFailed()
  return 'done'
}

function summarizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/\s+/g, ' ').trim().slice(0, 300)
}
