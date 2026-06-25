import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import type { EntityCode } from '../domain/entities/import'
import type { FieldParam } from './field-value-transform'
import type { MappedRow } from './import-row-mapper'
import {
  BitrixThrottleError,
  INTENSITY_LIMIT_PAUSE_MS,
  isIntensityLimitError,
  operatingThrottle,
  type BatchTime,
  type ThrottleSignal,
} from './bitrix-throttle'

export type RowResult = {
  row: number
  status: 'added' | 'updated' | 'error'
  error?: string
  /** Id do registro criado/atualizado (pra vincular contato/empresa ao principal). */
  id?: string
}

export type WriteResult = {
  results: RowResult[]
  /** Budget de operating estourou (por conta) → reenfileira esta importação. */
  throttle: ThrottleSignal | null
}

type BatchResponse = {
  result?: {
    result?: Record<string, unknown>
    result_error?: Record<string, unknown>
    result_total?: Record<string, number>
    result_time?: Record<string, BatchTime>
  }
  /** Envelope de tempo top-level: operating acumulado + reset (segundos / unix ts). */
  time?: BatchTime
}

type RowToWrite = MappedRow & { row: number }

function enc(value: string): string {
  return encodeURIComponent(value)
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const desc = e.error_description ?? e.errorDescription ?? e.error
    if (typeof desc === 'string' && desc.trim()) return desc
  }
  return JSON.stringify(err)
}

function serialize(params: FieldParam[]): string {
  return params
    .map(p => `fields[${p.path.map(enc).join('][')}]=${enc(p.value)}`)
    .join('&')
}

/** Chave de filtro do identificador (email/phone minúsculo; resto = code). */
function filterKey(code: string): string {
  if (code === 'EMAIL') return 'email'
  if (code === 'PHONE') return 'phone'
  return code
}

/**
 * Adapter por tipo de entidade: monta os comandos de busca/escrita do batch e
 * extrai o id do resultado da busca.
 */
type EntityAdapter = {
  /** Comando de busca por identificadores (null = sempre add). */
  listCommand(row: RowToWrite): string | null
  addCommand(params: FieldParam[]): string
  updateCommand(id: string, params: FieldParam[]): string
  /** Id a partir do resultado da BUSCA (crm.item.list etc). */
  extractId(listResult: unknown): string | null
  /** Id a partir do resultado da ESCRITA (add/update). */
  extractWriteId(writeResult: unknown): string | null
}

function crmAdapter(
  entityTypeId: number,
  extraParams: FieldParam[],
): EntityAdapter {
  return {
    listCommand(row) {
      if (row.identifiers.length === 0) return null
      const filters = row.identifiers
        .map(id => `filter[${filterKey(id.fieldName)}]=${enc(id.value)}`)
        .join('&')
      return `crm.item.list?entityTypeId=${entityTypeId}&${filters}`
    },
    addCommand(params) {
      const all = serialize([...params, ...extraParams])
      return `crm.item.add?entityTypeId=${entityTypeId}&${all}`
    },
    updateCommand(id, params) {
      const all = serialize([...params, ...extraParams])
      return `crm.item.update?entityTypeId=${entityTypeId}&id=${id}&${all}`
    },
    extractId(listResult) {
      const items = (listResult as { items?: { id?: number }[] })?.items
      const id = items?.[0]?.id
      return id != null ? String(id) : null
    },
    extractWriteId(writeResult) {
      const item = (writeResult as { item?: { id?: number } })?.item
      return item?.id != null ? String(item.id) : null
    },
  }
}

function taskAdapter(): EntityAdapter {
  return {
    listCommand(row) {
      if (row.identifiers.length === 0) return null
      const filters = row.identifiers
        .map(id => `filter[${id.fieldName}]=${enc(id.value)}`)
        .join('&')
      return `tasks.task.list?${filters}`
    },
    addCommand(params) {
      return `tasks.task.add?${serialize(params)}`
    },
    updateCommand(id, params) {
      return `tasks.task.update?taskId=${id}&${serialize(params)}`
    },
    extractId(listResult) {
      const tasks = (listResult as { tasks?: { id?: number | string }[] })
        ?.tasks
      const id = tasks?.[0]?.id
      return id != null ? String(id) : null
    },
    extractWriteId(writeResult) {
      const task = (writeResult as { task?: { id?: number | string } })?.task
      return task?.id != null ? String(task.id) : null
    },
  }
}

function feedAdapter(): EntityAdapter {
  // "Livefeed" = comentário na timeline de um registro CRM (ENTITY_ID +
  // ENTITY_TYPE + COMMENT). Sempre add (crm.timeline.comment.add), sem dedup.
  return {
    listCommand: () => null,
    addCommand: params => `crm.timeline.comment.add?${serialize(params)}`,
    updateCommand: (_id, params) =>
      `crm.timeline.comment.add?${serialize(params)}`,
    extractId: () => null,
    // crm.timeline.comment.add devolve o id do comentário direto (inteiro).
    extractWriteId: writeResult =>
      typeof writeResult === 'number' || typeof writeResult === 'string'
        ? String(writeResult)
        : null,
  }
}

function adapterFor(
  entityCode: EntityCode,
  entityTypeId: number | null,
  categoryId: number | null,
): EntityAdapter {
  if (entityCode === 'TASK') return taskAdapter()
  if (entityCode === 'FEED') return feedAdapter()
  const extra: FieldParam[] =
    categoryId !== null
      ? [{ path: ['categoryId'], value: String(categoryId) }]
      : []
  return crmAdapter(entityTypeId ?? 0, extra)
}

export class BitrixImportWriter {
  constructor(private readonly bitrix: BitrixClient) {}

  /**
   * Chama o batch convertendo o 503 `QUERY_LIMIT_EXCEEDED` (intensidade, por IP)
   * numa `BitrixThrottleError` que o worker traduz pra pausa global da fila.
   */
  private async batch(cmd: Record<string, string>): Promise<BatchResponse> {
    try {
      return await this.bitrix.callMethod<BatchResponse>('batch', {
        halt: 0,
        cmd,
      })
    } catch (error) {
      if (isIntensityLimitError(error)) {
        throw new BitrixThrottleError({
          kind: 'intensity',
          pauseMs: INTENSITY_LIMIT_PAUSE_MS,
        })
      }
      throw error
    }
  }

  async writePage(
    entityCode: EntityCode,
    entityTypeId: number | null,
    categoryId: number | null,
    rows: RowToWrite[],
  ): Promise<WriteResult> {
    const adapter = adapterFor(entityCode, entityTypeId, categoryId)

    // Dedup intra-página: mesmo identificador → 1 grupo, escreve só o
    // representante (última linha) e espalha o id pros membros. Evita 2 ADD do
    // mesmo identificador no batch (= duplicata); em sub, 1 registro p/ N principais.
    const groups = this.groupByIdentifier(rows)
    const reps = groups.map(g => g.rep)

    // 1) Busca existentes (batch list) — só representantes com identificador.
    const { found: foundIds, ambiguous } = await this.lookupExisting(
      adapter,
      reps,
    )

    // 2) Escreve (batch add/update). Linha com match ambíguo (>1) NÃO é escrita:
    // adicionar criaria duplicata e atualizar pegaria o registro errado.
    const cmd: Record<string, string> = {}
    for (const [i, row] of reps.entries()) {
      if (ambiguous.has(i)) continue
      const key = `row_${i}`
      const existingId = foundIds.get(i)
      cmd[key] = existingId
        ? adapter.updateCommand(existingId, row.params)
        : adapter.addCommand(row.params)
    }

    const res =
      Object.keys(cmd).length > 0
        ? await this.batch(cmd)
        : { result: { result: {}, result_error: {} } }
    const repResult = this.collectResults(
      adapter,
      reps,
      foundIds,
      ambiguous,
      res,
    )

    // Espalha o resultado do rep pros membros, preservando a ordem original.
    const byRow = new Map<number, RowResult>()
    for (const [i, group] of groups.entries()) {
      const rr = repResult.results[i] as RowResult
      for (const member of group.members) {
        byRow.set(member.row, { ...rr, row: member.row })
      }
    }
    const results = rows.map(r => byRow.get(r.row) as RowResult)

    const written = repResult.results
    apiLogger.info({
      app: 'importsheet',
      entityCode,
      rows: rows.length,
      written: written.length,
      deduped: rows.length - reps.length,
      added: written.filter(r => r.status === 'added').length,
      updated: written.filter(r => r.status === 'updated').length,
      errors: written.filter(r => r.status === 'error').length,
      ids: written.map(r => r.id ?? '·').join(','),
      ...(written.some(r => r.status === 'error')
        ? {
            errorDetails: written
              .filter(r => r.status === 'error')
              .map(r => `r${r.row}:${r.error}`),
          }
        : {}),
    }, 'Import gravado no Bitrix')

    return { results, throttle: repResult.throttle }
  }

  // Agrupa por assinatura de identificador. Sem identificador = grupo próprio
  // (nunca colapsa). Representante = última linha (last wins).
  private groupByIdentifier(
    rows: RowToWrite[],
  ): { rep: RowToWrite; members: RowToWrite[] }[] {
    const order: string[] = []
    const bySig = new Map<string, RowToWrite[]>()
    let noIdentSeq = 0
    for (const row of rows) {
      const sig =
        row.identifiers.length === 0
          ? `__noident_${noIdentSeq++}`
          : row.identifiers
              .map(id => `${id.fieldName}=${id.value}`)
              .sort()
              .join('|')
      const members = bySig.get(sig)
      if (members) {
        members.push(row)
      } else {
        bySig.set(sig, [row])
        order.push(sig)
      }
    }
    return order.map(sig => {
      const members = bySig.get(sig) as RowToWrite[]
      return { rep: members[members.length - 1] as RowToWrite, members }
    })
  }

  private async lookupExisting(
    adapter: EntityAdapter,
    rows: RowToWrite[],
  ): Promise<{ found: Map<number, string>; ambiguous: Set<number> }> {
    const cmd: Record<string, string> = {}
    const keyToIndex = new Map<string, number>()
    for (const [i, row] of rows.entries()) {
      const command = adapter.listCommand(row)
      if (command) {
        const key = `row_${i}`
        cmd[key] = command
        keyToIndex.set(key, i)
      }
    }

    const found = new Map<number, string>()
    const ambiguous = new Set<number>()
    if (Object.keys(cmd).length === 0) return { found, ambiguous }

    const res = await this.batch(cmd)
    const results = res.result?.result ?? {}
    const totals = res.result?.result_total ?? {}

    for (const [key, index] of keyToIndex) {
      const total = totals[key] ?? 0
      // >1 match = identificador não-único → não dá pra escolher com segurança.
      if (total > 1) {
        ambiguous.add(index)
        continue
      }
      if (total === 1) {
        const id = adapter.extractId(results[key])
        if (id) found.set(index, id)
      }
    }

    return { found, ambiguous }
  }

  private collectResults(
    adapter: EntityAdapter,
    rows: RowToWrite[],
    foundIds: Map<number, string>,
    ambiguous: Set<number>,
    res: BatchResponse,
  ): WriteResult {
    const results = res.result?.result ?? {}
    const errors = res.result?.result_error ?? {}

    const rowResults: RowResult[] = rows.map((r, i) => {
      // Não escrita por match ambíguo → reporta como erro (vai pro last_error).
      if (ambiguous.has(i)) {
        return {
          row: r.row,
          status: 'error',
          error: 'Match ambíguo: identificador casou com mais de um registro',
        }
      }
      const key = `row_${i}`
      const err = errors[key]
      if (err) {
        return { row: r.row, status: 'error', error: errorMessage(err) }
      }
      const existing = foundIds.get(i)
      const id = existing ?? adapter.extractWriteId(results[key]) ?? undefined
      return {
        row: r.row,
        status: existing ? 'updated' : 'added',
        id,
      }
    })

    // Operating (acumulado/segundos do método na janela) vem por-comando em
    // result_time; pega o maior + o time top-level se existir.
    const samples: BatchTime[] = Object.values(res.result?.result_time ?? {})
    if (res.time) samples.push(res.time)
    const throttle = operatingThrottle(samples)

    return { results: rowResults, throttle }
  }
}
