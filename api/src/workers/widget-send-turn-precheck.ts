import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')

/** Teto da memória: muito acima do número de linhas Z-API ativas. */
const MAX_REMEMBERED_LINES = 10_000

/**
 * A chave da fila FIFO de cada linha (`zApiInstanceId`), pelo item de assinatura.
 *
 * A row só guarda o id da instância no banco; a chave da fila só aparece depois de
 * resolver a linha, que é a parte cara do despacho (contexto da aplicação no
 * Bitrix). Guardar a chave da última resolução deixa quem está fora da vez desistir
 * sem pagar isso. Chave desatualizada (linha reprovisionada) não erra a ordem: o
 * ticket não está na fila antiga, e o despacho completo decide.
 */
export class LineKeyMemory {
  private readonly keys = new Map<string, string>()

  get(subscriptionItemId: string): string | undefined {
    return this.keys.get(subscriptionItemId)
  }

  remember(subscriptionItemId: string, lineKey: string): void {
    if (this.keys.size >= MAX_REMEMBERED_LINES) this.keys.clear()
    this.keys.set(subscriptionItemId, lineKey)
  }
}

export type TurnPrecheckRow = {
  id: string
  subscriptionItemId: string
  status: string
  queueSeq: number | null
  providerMessageId: string | null
}

export type TurnPrecheckDeps = {
  lineKeys: LineKeyMemory
  cadence: Pick<SendCadence, 'peekTurn'>
  now?: () => Date
}

/**
 * `{ deferUntil }` quando a row está na fila da linha atrás de outra: o job volta
 * depois sem resolver a linha nem montar o despacho. `null` = segue o caminho
 * completo, que é quem decide a vez (`reserve`, atômico) — este atalho só desiste
 * cedo, nunca deixa ninguém passar na frente.
 *
 * Só a row `PENDING` ainda não entregue: as demais precisam do despacho para
 * chegar ao desfecho (retomar efeitos, `UNKNOWN`, sair da fila).
 */
export async function precheckLineTurn(
  row: TurnPrecheckRow,
  deps: TurnPrecheckDeps,
): Promise<{ deferUntil: number } | null> {
  if (row.status !== 'PENDING' || row.providerMessageId) return null
  if (row.queueSeq == null) return null

  const lineKey = deps.lineKeys.get(row.subscriptionItemId)
  if (!lineKey) return null

  try {
    const turn = await deps.cadence.peekTurn(
      lineKey,
      row.id,
      deps.now ? deps.now() : new Date(),
    )
    return turn.behind ? { deferUntil: turn.retryAt } : null
  } catch (err) {
    log.warn(
      { app: 'thinkzap', outboxId: row.id, lineKey, err },
      'Checagem rápida da vez falhou; seguindo pelo despacho completo',
    )
    return null
  }
}
