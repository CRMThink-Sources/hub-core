import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'
import type {
  EntityCode,
  ImportConfigMapping,
  ImportSheetImport,
} from '../domain/entities/import'
import type { ImportSheetImportRepository } from '../domain/repositories/importsheet-import.repository'
import type { GoogleSheetsGateway } from '../domain/gateways/google-sheets.gateway'
import { GoogleConnectionService } from './google-connection.service'
import { runWithGoogleTokenRetry } from './run-with-google-token-retry'
import { resolveSchedule, type CreateImportSchedule } from './schedule'
import {
  loadCrmFieldMeta,
  loadTaskFieldMeta,
  type FieldMetaResult,
} from './bitrix-field-meta'
import { isRowEmpty, mapRow } from './import-row-mapper'
import { BitrixImportWriter, type RowResult } from './bitrix-import-writer'
import { BitrixThrottleError, type ThrottleSignal } from './bitrix-throttle'
import { withLock } from '../infra/redis-lock'

/** Linhas por página (≤50 = limite de comandos do batch Bitrix). */
const PAGE_SIZE = 50
/** entityTypeId fixos do Bitrix p/ contato e empresa. */
const CONTACT_ENTITY_TYPE_ID = 3
const COMPANY_ENTITY_TYPE_ID = 4
/** Reagendamento curto quando o Bitrix pede pausa (carga alta). */
const PAUSE_RESCHEDULE_MS = 5 * 60 * 1000
/** TTL do lock de execução por importação — uma página é rápida. */
const RUN_LOCK_TTL_MS = 5 * 60 * 1000

export type MakeBitrixClient = (appId: string) => Promise<BitrixClient>

/**
 * Resultado de processar UMA página. O worker usa pra decidir o próximo passo:
 * - `done`        → importação terminou (sem mais páginas).
 * - `continue`    → re-enfileira a próxima página no fim da fila (round-robin).
 * - `throttled-operating` → budget de operating (por conta) → re-enfileira com delay.
 * - `throttled-intensity` → 503 (por IP) → worker pausa a fila e re-roda o mesmo job.
 * - `skipped`     → lock ocupado / desabilitada / inexistente.
 */
export type ImportRunOutcome =
  | { status: 'skipped' }
  | { status: 'done' }
  | { status: 'continue' }
  | { status: 'throttled-operating'; resetAt: number | null }
  | { status: 'throttled-intensity'; pauseMs: number }

export class RunImportService {
  constructor(
    private readonly repository: ImportSheetImportRepository,
    private readonly connection: GoogleConnectionService,
    private readonly sheets: GoogleSheetsGateway,
    private readonly makeBitrix: MakeBitrixClient,
  ) {}

  /**
   * `continuation` = re-enfileiramento da próxima página do mesmo run (carrega o
   * erro acumulado). `false` = run novo (manual/agendado) → zera o erro anterior.
   */
  async execute(
    importId: number,
    continuation = false,
  ): Promise<ImportRunOutcome> {
    // Lock por importação: poller + run manual não rodam a mesma 2x ao mesmo tempo.
    const outcome = await withLock(
      `importsheet:run:${importId}`,
      RUN_LOCK_TTL_MS,
      () => this.guardedRun(importId, continuation),
    )
    if (outcome === null) {
      apiLogger.info(
        { app: 'importsheet', importId },
        'Import run skipped (already running)',
      )
      return { status: 'skipped' }
    }
    return outcome
  }

  private async guardedRun(
    importId: number,
    continuation: boolean,
  ): Promise<ImportRunOutcome> {
    const imp = await this.repository.findByIdAny(importId)
    if (!imp) {
      apiLogger.warn(
        { app: 'importsheet', importId },
        'Import not found for run',
      )
      return { status: 'skipped' }
    }
    if (!imp.enabled) return { status: 'skipped' }

    try {
      return await this.runOnePage(imp, continuation)
    } catch (error) {
      // 503 de intensidade (por IP): não é falha — vira pausa da fila no worker.
      if (
        error instanceof BitrixThrottleError &&
        error.signal.kind === 'intensity'
      ) {
        apiLogger.warn(
          { app: 'importsheet', importId },
          'Import run throttled (intensity 503) — pausing worker',
        )
        return { status: 'throttled-intensity', pauseMs: error.signal.pauseMs }
      }
      apiLogger.error(
        { app: 'importsheet', importId, error },
        'Import run failed',
      )
      // Relê o cursor: cada página persiste startRow, então o erro não reverte
      // o progresso já feito (perderia/reimportaria páginas).
      const current = await this.repository.findByIdAny(imp.id)
      await this.repository.markRunResult(imp.id, {
        startRow: current?.startRow ?? imp.startRow,
        lastRunAt: new Date(),
        lastRunStatus: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        nextRunAt: new Date(Date.now() + PAUSE_RESCHEDULE_MS),
      })
      return { status: 'done' }
    }
  }

  /**
   * Processa UMA página da planilha. Persiste o cursor e devolve o outcome pro
   * worker decidir continuação/throttle. Não faz loop in-process: a próxima
   * página é re-enfileirada pelo worker → round-robin natural via FIFO do BullMQ.
   */
  private async runOnePage(
    imp: ImportSheetImport,
    continuation: boolean,
  ): Promise<ImportRunOutcome> {
    const { config } = imp
    const { entityCode, entityTypeId, categoryId } = config.target

    // Agrupa o de-para por entidade-destino.
    const mainMappings = config.mappings.filter(
      m => m.target !== 'contact' && m.target !== 'company',
    )
    const contactMappings = config.mappings.filter(m => m.target === 'contact')
    const companyMappings = config.mappings.filter(m => m.target === 'company')

    const bitrix = await this.makeBitrix(imp.appId)
    const meta = await this.loadMeta(bitrix, entityCode, entityTypeId)
    const contactMeta = contactMappings.length
      ? await loadCrmFieldMeta(bitrix, CONTACT_ENTITY_TYPE_ID)
      : null
    const companyMeta = companyMappings.length
      ? await loadCrmFieldMeta(bitrix, COMPANY_ENTITY_TYPE_ID)
      : null
    const writer = new BitrixImportWriter(bitrix)

    const fromRow = imp.startRow
    let pageErrors = 0
    // Continuação carrega o erro do run; run novo começa limpo (não gruda partial).
    let firstError: string | null = continuation
      ? (imp.lastError ?? null)
      : null
    const throttleSignals: ThrottleSignal[] = []

    const accountError = (results: RowResult[]): void => {
      for (const result of results) {
        if (result.status === 'error') {
          pageErrors++
          if (!firstError) firstError = `Linha ${result.row}: ${result.error}`
        }
      }
    }
    const accountThrottle = (signal: ThrottleSignal | null): void => {
      if (signal) throttleSignals.push(signal)
    }

    // Resolve o título atual da aba pelo sheetId (imutável) → sobrevive a rename.
    const tabTitle = await this.resolveTabTitle(imp)

    const rows = await runWithGoogleTokenRetry(
      this.connection,
      imp.appId,
      token =>
        this.sheets.getRows(
          token,
          config.source.spreadsheetId,
          tabTitle,
          fromRow,
          PAGE_SIZE,
        ),
    )

    // Planilha inacessível (404/403/aba inválida).
    if (rows === null) {
      throw new Error('Planilha ou aba inacessível')
    }

    // Para na 1ª linha vazia = fim dos dados (presença = entidade principal).
    const dataRows: { row: number; values: string[] }[] = []
    for (const r of rows) {
      if (isRowEmpty(r.values, mainMappings)) break
      dataRows.push(r)
    }
    const lastDataRow = dataRows[dataRows.length - 1]

    // Sem dados nesta página = importação terminou.
    if (!lastDataRow) return this.finishImport(imp, fromRow, firstError)

    // 1) Contato e empresa primeiro → ids por linha pra vincular no principal.
    const contactIds = contactMeta
      ? await this.writeSub(
          'CONTACT',
          CONTACT_ENTITY_TYPE_ID,
          contactMappings,
          contactMeta,
          dataRows,
          writer,
          accountError,
          accountThrottle,
        )
      : new Map<number, string>()
    const companyIds = companyMeta
      ? await this.writeSub(
          'COMPANY',
          COMPANY_ENTITY_TYPE_ID,
          companyMappings,
          companyMeta,
          dataRows,
          writer,
          accountError,
          accountThrottle,
        )
      : new Map<number, string>()

    // 2) Entidade principal com contactId/companyId injetados.
    const mainMapped = dataRows.map(r => {
      const m = mapRow(r.values, mainMappings, meta.metas, meta.statusLists)
      const contactId = contactIds.get(r.row)
      const companyId = companyIds.get(r.row)
      if (contactId) m.params.push({ path: ['contactId'], value: contactId })
      if (companyId) m.params.push({ path: ['companyId'], value: companyId })
      return { row: r.row, ...m }
    })

    const write = await writer.writePage(
      entityCode,
      entityTypeId,
      categoryId,
      mainMapped,
    )
    accountError(write.results)
    accountThrottle(write.throttle)

    const nextRow = lastDataRow.row + 1
    const hasMore = dataRows.length >= PAGE_SIZE

    // Página incompleta = última → finaliza a importação.
    if (!hasMore) return this.finishImport(imp, nextRow, firstError)

    // Persiste o cursor (página concluída) com status corrente.
    await this.repository.markRunResult(imp.id, {
      startRow: nextRow,
      lastRunAt: new Date(),
      lastRunStatus: 'running',
      lastError: firstError,
      nextRunAt: imp.nextRunAt,
    })

    apiLogger.info(
      {
        app: 'importsheet',
        importId: imp.id,
        startRow: nextRow,
        pageErrors,
        throttle: throttleSignals.map(s => s.kind),
      },
      'Import page processed',
    )

    // Operating estourou (por conta) → re-enfileira esta importação com delay.
    const operating = throttleSignals.find(
      (s): s is Extract<ThrottleSignal, { kind: 'operating' }> =>
        s.kind === 'operating',
    )
    if (operating) {
      return { status: 'throttled-operating', resetAt: operating.resetAt }
    }
    return { status: 'continue' }
  }

  /**
   * Título da aba pode mudar (rename no Google) e o range A1 é por nome → quebra.
   * O `sheetId` é imutável: resolve o nome atual por ele. Persiste o novo título
   * pra config/UI ficarem coerentes. Aba inexistente (excluída) → erro claro.
   */
  private async resolveTabTitle(imp: ImportSheetImport): Promise<string> {
    const { source } = imp.config
    const details = await runWithGoogleTokenRetry(
      this.connection,
      imp.appId,
      token => this.sheets.getSpreadsheet(token, source.spreadsheetId),
    )
    if (!details) throw new Error('Planilha inacessível')

    const tab = details.tabs.find(t => t.sheetId === source.tab.sheetId)
    if (!tab) {
      throw new Error(
        `Aba não encontrada (sheetId ${source.tab.sheetId}) — pode ter sido excluída`,
      )
    }

    if (tab.title !== source.tab.title) {
      apiLogger.info(
        {
          app: 'importsheet',
          importId: imp.id,
          from: source.tab.title,
          to: tab.title,
        },
        'Tab renamed — updating stored title',
      )
      await this.repository.updateTabTitle(imp.id, tab.title)
    }
    return tab.title
  }

  /** Encerra a importação: status final + nextRunAt do agendamento. */
  private async finishImport(
    imp: ImportSheetImport,
    finalRow: number,
    firstError: string | null,
  ): Promise<ImportRunOutcome> {
    const status = firstError ? 'partial' : 'success'
    const nextRunAt = resolveSchedule(this.toSchedule(imp)).nextRunAt

    await this.repository.markRunResult(imp.id, {
      startRow: finalRow,
      lastRunAt: new Date(),
      lastRunStatus: status,
      lastError: firstError,
      nextRunAt,
    })

    apiLogger.info(
      { app: 'importsheet', importId: imp.id, status, startRow: finalRow },
      'Import run finished',
    )
    return { status: 'done' }
  }

  /**
   * Cria/atualiza uma sub-entidade (contato/empresa) pra a página e devolve
   * o id por linha (pra vincular no principal). Processa só linhas com dado.
   */
  private async writeSub(
    entityCode: EntityCode,
    entityTypeId: number,
    mappings: ImportConfigMapping[],
    meta: FieldMetaResult,
    dataRows: { row: number; values: string[] }[],
    writer: BitrixImportWriter,
    accountError: (results: RowResult[]) => void,
    accountThrottle: (signal: ThrottleSignal | null) => void,
  ): Promise<Map<number, string>> {
    const mapped = dataRows
      .map(r => ({
        row: r.row,
        ...mapRow(r.values, mappings, meta.metas, meta.statusLists),
      }))
      .filter(m => m.params.length > 0)

    const ids = new Map<number, string>()
    if (mapped.length === 0) return ids

    const write = await writer.writePage(entityCode, entityTypeId, null, mapped)
    accountError(write.results)
    accountThrottle(write.throttle)
    for (const result of write.results) {
      if (result.id) ids.set(result.row, result.id)
    }
    return ids
  }

  private async loadMeta(
    bitrix: BitrixClient,
    entityCode: ImportSheetImport['config']['target']['entityCode'],
    entityTypeId: number | null,
  ): Promise<FieldMetaResult> {
    if (entityCode === 'TASK') return loadTaskFieldMeta(bitrix)
    if (entityCode === 'FEED') return { metas: new Map(), statusLists: {} }
    return loadCrmFieldMeta(bitrix, entityTypeId ?? 0)
  }

  /** Reconstrói o agendamento a partir das colunas pra recalcular nextRunAt. */
  private toSchedule(imp: ImportSheetImport): CreateImportSchedule {
    if (imp.scheduleMode === 'HOURS') {
      return { mode: 'hours', everyHours: imp.everyHours ?? 1 }
    }
    if (imp.scheduleMode === 'DAYS') {
      return { mode: 'days', weekdays: imp.weekdays ?? [] }
    }
    return { mode: 'manual' }
  }
}
