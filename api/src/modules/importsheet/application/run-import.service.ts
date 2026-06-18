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
import { ResponsibleResolver } from './responsible-resolver'
import { BitrixImportWriter, type RowResult } from './bitrix-import-writer'
import { BitrixThrottleError, type ThrottleSignal } from './bitrix-throttle'
import {
  parseImportError,
  serializeImportError,
  type ImportErrorRow,
} from './import-error'
import { withRenewingLock } from '../infra/redis-lock'
import { redisConnection } from '@/queue/redis-connection'
import { env } from '@/config/env'
import { BitrixAppOptionService } from '@/shared/application/bitrix-app-option.service'
import { BitrixSystemNotificationService } from '@/shared/application/bitrix-system-notification.service'
import { NotifySettingsService } from './notify-settings.service'

// Linhas por página (≤50 = teto do batch Bitrix). Default 20 via env.
const PAGE_SIZE = env.importsheet.pageSize
const CONTACT_ENTITY_TYPE_ID = 3
const COMPANY_ENTITY_TYPE_ID = 4
const RUN_LOCK_TTL_MS = 5 * 60 * 1000
const TAB_TITLE_TTL_SECONDS = 10 * 60
const PAGE_MARKER_TTL_SECONDS = 24 * 60 * 60
// Teto de linhas com erro guardadas por run (evita estourar o last_error).
const MAX_ERROR_ROWS = 50
// TTL do marcador de reprocess: cobre retry pós-crash sem travar reprocess futuro.
const REPROCESS_MARKER_TTL_SECONDS = 60 * 60
// Janela anti-spam da notificação de erro: 1 por importação por janela.
const NOTIFY_COOLDOWN_SECONDS = 6 * 60 * 60

type WrittenPageMarker = {
  nextRow: number
  hasMore: boolean
  errorRows: ImportErrorRow[]
}

// Deps de escrita carregadas 1x por run (cliente Bitrix, metas, mapeamentos).
type WriteContext = {
  bitrix: BitrixClient
  writer: BitrixImportWriter
  meta: FieldMetaResult
  contactMeta: FieldMetaResult | null
  companyMeta: FieldMetaResult | null
  mainMappings: ImportConfigMapping[]
  contactMappings: ImportConfigMapping[]
  companyMappings: ImportConfigMapping[]
}

type ResolvedSub = { contactId?: string; companyId?: string }

type WritePageResult = {
  results: RowResult[]
  throttle: ThrottleSignal[]
  // Ids de sub por linha — guardados no errorRow pro reprocess não recriar contato/empresa.
  subIds: Map<number, ResolvedSub>
}

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

export type ReprocessOutcome = {
  status: 'ok' | 'throttled' | 'skipped'
  errorRows: ImportErrorRow[]
}

export class RunImportService {
  constructor(
    private readonly repository: ImportSheetImportRepository,
    private readonly connection: GoogleConnectionService,
    private readonly sheets: GoogleSheetsGateway,
    private readonly makeBitrix: MakeBitrixClient,
  ) {}

  async execute(importId: number): Promise<ImportRunOutcome> {
    const outcome = await withRenewingLock(
      `importsheet:run:${importId}`,
      RUN_LOCK_TTL_MS,
      () => this.guardedRun(importId),
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

  // Reprocessa linhas isoladas que falharam. Sub já criado (contato/empresa) é
  // reusado via id guardado no errorRow → não recria.
  async reprocessRows(
    importId: number,
    requestedRows: number[],
  ): Promise<ReprocessOutcome> {
    const outcome = await withRenewingLock(
      `importsheet:run:${importId}`,
      RUN_LOCK_TTL_MS,
      () => this.guardedReprocess(importId, requestedRows),
    )
    return outcome ?? { status: 'skipped', errorRows: [] }
  }

  private async guardedReprocess(
    importId: number,
    requestedRows: number[],
  ): Promise<ReprocessOutcome> {
    const imp = await this.repository.findByIdAny(importId)
    if (!imp) return { status: 'skipped', errorRows: [] }

    const current = this.existingErrorRows(imp)
    // Guard server-side: dedup + só linhas que estão na lista de erro (não confia na UI).
    const allowed = [...new Set(requestedRows)].filter(r =>
      current.some(e => e.row === r),
    )
    if (allowed.length === 0) return { status: 'ok', errorRows: current }

    // Idempotência: se o persist falhar após escrever no Bitrix, o replay aplica
    // o resultado gravado sem reescrever. Marcador por conjunto de linhas (mesmo pedido).
    const markerKey = this.reprocessMarkerKey(importId, allowed)
    const replay = await this.peekReprocessResult(markerKey)
    if (replay) {
      await this.persistReprocessResult(imp, replay)
      await this.clearMarkerKey(markerKey)
      return { status: 'ok', errorRows: replay }
    }

    const ctx = await this.loadWriteContext(imp)
    const tabTitle = await this.resolveTabTitle(imp)

    const dataRows: { row: number; values: string[] }[] = []
    for (const row of allowed) {
      const got = await runWithGoogleTokenRetry(
        this.connection,
        imp.appId,
        token =>
          this.sheets.getRows(
            token,
            imp.config.source.spreadsheetId,
            tabTitle,
            row,
            1,
          ),
      )
      const cells = got?.[0]?.values
      if (cells && !isRowEmpty(cells, ctx.mainMappings)) {
        dataRows.push({ row, values: cells })
      }
    }

    // Reusa contato/empresa já criados (guardados no errorRow) → não duplica sub.
    const resolved = new Map<number, ResolvedSub>()
    for (const e of current) {
      if (e.contactId || e.companyId) {
        resolved.set(e.row, { contactId: e.contactId, companyId: e.companyId })
      }
    }

    const errored = new Map<number, string>()
    const writtenSubIds = new Map<number, ResolvedSub>()
    if (dataRows.length > 0) {
      let written: WritePageResult
      try {
        written = await this.writeDataRows(imp, ctx, dataRows, resolved)
      } catch (error) {
        if (
          error instanceof BitrixThrottleError &&
          error.signal.kind === 'intensity'
        ) {
          return { status: 'throttled', errorRows: current }
        }
        throw error
      }
      for (const r of written.results) {
        if (r.status === 'error')
          errored.set(r.row, r.error ?? 'Erro desconhecido')
      }
      for (const [row, sub] of written.subIds) writtenSubIds.set(row, sub)
    }

    // Linha que esvaziou na planilha sai da lista; a que falhou de novo atualiza msg + subs.
    const next = current
      .filter(e => !allowed.includes(e.row) || errored.has(e.row))
      .map(e => {
        const message = errored.get(e.row)
        if (!message) return e
        const sub = writtenSubIds.get(e.row)
        return {
          row: e.row,
          message,
          ...(sub?.contactId ? { contactId: sub.contactId } : {}),
          ...(sub?.companyId ? { companyId: sub.companyId } : {}),
        }
      })

    // Marcador ANTES de persistir: se o markRunResult falhar, o replay reconstrói.
    await this.setReprocessResult(markerKey, next)
    await this.persistReprocessResult(imp, next)
    await this.clearMarkerKey(markerKey)

    return { status: 'ok', errorRows: next }
  }

  private async persistReprocessResult(
    imp: ImportSheetImport,
    next: ImportErrorRow[],
  ): Promise<void> {
    await this.repository.markRunResult(imp.id, {
      startRow: imp.startRow,
      lastRunAt: new Date(),
      lastRunStatus: next.length > 0 ? 'partial' : 'success',
      lastError:
        next.length > 0
          ? serializeImportError({
              kind: 'partial',
              cursorRow: imp.startRow,
              rows: next,
            })
          : null,
      nextRunAt: imp.nextRunAt,
    })
  }

  private reprocessMarkerKey(importId: number, rows: number[]): string {
    const sig = [...rows].sort((a, b) => a - b).join('-')
    return `importsheet:reprocess:${importId}:${sig}`
  }

  private async peekReprocessResult(
    key: string,
  ): Promise<ImportErrorRow[] | null> {
    try {
      const raw = await redisConnection.get(key)
      return raw ? (JSON.parse(raw) as ImportErrorRow[]) : null
    } catch {
      return null
    }
  }

  private async setReprocessResult(
    key: string,
    rows: ImportErrorRow[],
  ): Promise<void> {
    try {
      await redisConnection.set(
        key,
        JSON.stringify(rows),
        'EX',
        REPROCESS_MARKER_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'importsheet', error },
        'Failed to persist reprocess marker (idempotency degraded)',
      )
    }
  }

  private async clearMarkerKey(key: string): Promise<void> {
    try {
      await redisConnection.del(key)
    } catch {
      // marcador órfão expira pelo TTL
    }
  }

  private async guardedRun(importId: number): Promise<ImportRunOutcome> {
    const imp = await this.repository.findByIdAny(importId)
    if (!imp) {
      apiLogger.warn(
        { app: 'importsheet', importId },
        'Import not found for run',
      )
      return { status: 'skipped' }
    }
    if (imp.scheduleMode !== 'MANUAL' && !imp.enabled) {
      return { status: 'skipped' }
    }

    try {
      return await this.runOnePage(imp)
    } catch (error) {
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
      const current = await this.repository.findByIdAny(imp.id)
      const cursorRow = current?.startRow ?? imp.startRow
      const message = error instanceof Error ? error.message : 'Unknown error'
      const isScheduled = imp.scheduleMode !== 'MANUAL'
      // Preserva os erros por-linha já acumulados pra seguirem reprocessáveis.
      const prior = this.existingErrorRows(current ?? imp)
      // Agendado: pausa (enabled=false) — já basta pra sair do poller (findDue
      // exige enabled). Mantém nextRunAt pra religar o toggle retomar de onde
      // parou; sem isso o re-enable ficaria preso (nextRunAt null nunca vence).
      await this.repository.markRunResult(imp.id, {
        startRow: cursorRow,
        lastRunAt: new Date(),
        lastRunStatus: 'error',
        lastError: serializeImportError({
          kind: 'fatal',
          cursorRow,
          message,
          ...(prior.length > 0 ? { rows: prior } : {}),
        }),
        nextRunAt: isScheduled ? imp.nextRunAt : null,
        ...(isScheduled ? { enabled: false } : {}),
      })
      await this.notifyErrors(imp, prior.length, message)
      return { status: 'done' }
    }
  }

  private async runOnePage(imp: ImportSheetImport): Promise<ImportRunOutcome> {
    // Idempotência: página já escrita num retry/crash anterior → só avança o
    // cursor, sem reescrever (senão linhas add-only duplicariam).
    const replay = await this.peekPageMarker(imp.id, imp.startRow)
    if (replay) return this.replayPage(imp, replay)

    const ctx = await this.loadWriteContext(imp)

    const fromRow = imp.startRow
    // Preserva os erros não resolvidos entre runs (só o reprocess os remove);
    // o worker segue em ordem da planilha sem voltar pras linhas que erraram.
    const errorRows: ImportErrorRow[] = this.existingErrorRows(imp)
    const throttleSignals: ThrottleSignal[] = []

    const accountErrors = (
      results: RowResult[],
      subIds: Map<number, ResolvedSub>,
    ): void => {
      for (const result of results) {
        if (result.status !== 'error') continue
        if (errorRows.length >= MAX_ERROR_ROWS) break
        if (errorRows.some(e => e.row === result.row)) continue
        const sub = subIds.get(result.row)
        errorRows.push({
          row: result.row,
          message: result.error ?? 'Erro desconhecido',
          ...(sub?.contactId ? { contactId: sub.contactId } : {}),
          ...(sub?.companyId ? { companyId: sub.companyId } : {}),
        })
      }
    }

    const tabTitle = await this.resolveTabTitle(imp)

    const rows = await runWithGoogleTokenRetry(
      this.connection,
      imp.appId,
      token =>
        this.sheets.getRows(
          token,
          imp.config.source.spreadsheetId,
          tabTitle,
          fromRow,
          PAGE_SIZE,
        ),
    )

    // Planilha inacessível (404/403/aba inválida). Pode ser rename → invalida cache.
    if (rows === null) {
      await this.invalidateTabTitleCache(imp.id)
      throw new Error('Planilha ou aba inacessível')
    }

    // A API omite as linhas vazias do FIM do range, mas devolve as do MEIO
    // como []. Pula as vazias e detecta o fim por página incompleta.
    const dataRows = rows.filter(r => !isRowEmpty(r.values, ctx.mainMappings))
    const hasMore = rows.length >= PAGE_SIZE
    const nextRow = fromRow + rows.length

    if (dataRows.length === 0) return this.finishImport(imp, nextRow, errorRows)

    const written = await this.writeDataRows(imp, ctx, dataRows)
    accountErrors(written.results, written.subIds)
    throttleSignals.push(...written.throttle)

    // Marcador ANTES do cursor: crash/retry daqui pra frente vira replay.
    await this.setPageMarker(imp.id, fromRow, { nextRow, hasMore, errorRows })

    if (!hasMore) return this.finishImport(imp, nextRow, errorRows)

    await this.repository.markRunResult(imp.id, {
      startRow: nextRow,
      lastRunAt: new Date(),
      lastRunStatus: 'running',
      lastError: this.serializePartial(nextRow, errorRows),
      nextRunAt: imp.nextRunAt,
    })
    await this.clearPageMarker(imp.id, fromRow)

    apiLogger.info(
      {
        app: 'importsheet',
        importId: imp.id,
        startRow: nextRow,
        pageErrors: errorRows.length,
        throttle: throttleSignals.map(s => s.kind),
      },
      'Import page processed',
    )

    const operating = throttleSignals.find(
      (s): s is Extract<ThrottleSignal, { kind: 'operating' }> =>
        s.kind === 'operating',
    )
    if (operating) {
      return { status: 'throttled-operating', resetAt: operating.resetAt }
    }
    return { status: 'continue' }
  }

  // Carrega cliente Bitrix, metas e mapeamentos agrupados por entidade-destino.
  private async loadWriteContext(
    imp: ImportSheetImport,
  ): Promise<WriteContext> {
    const { config } = imp
    const { entityCode, entityTypeId } = config.target
    const mainMappings = config.mappings.filter(
      m => m.target !== 'contact' && m.target !== 'company',
    )
    const contactMappings = config.mappings.filter(m => m.target === 'contact')
    const companyMappings = config.mappings.filter(m => m.target === 'company')

    const bitrix = await this.makeBitrix(imp.appId)
    const meta = await this.loadMeta(
      bitrix,
      imp.appId,
      entityCode,
      entityTypeId,
    )
    const contactMeta = contactMappings.length
      ? await loadCrmFieldMeta(bitrix, imp.appId, CONTACT_ENTITY_TYPE_ID)
      : null
    const companyMeta = companyMappings.length
      ? await loadCrmFieldMeta(bitrix, imp.appId, COMPANY_ENTITY_TYPE_ID)
      : null

    return {
      bitrix,
      writer: new BitrixImportWriter(bitrix),
      meta,
      contactMeta,
      companyMeta,
      mainMappings,
      contactMappings,
      companyMappings,
    }
  }

  // Escreve linhas (contato/empresa → principal). Usado pelo run de página e pelo reprocess.
  private async writeDataRows(
    imp: ImportSheetImport,
    ctx: WriteContext,
    dataRows: { row: number; values: string[] }[],
    resolved?: Map<number, ResolvedSub>,
  ): Promise<WritePageResult> {
    const { config } = imp
    const { entityCode, entityTypeId, categoryId } = config.target
    const results: RowResult[] = []
    const throttle: ThrottleSignal[] = []

    // Sub-entidade já criada num run/tentativa anterior → reusa o id (não reescreve).
    const resolvedContact = new Map<number, string>()
    const resolvedCompany = new Map<number, string>()
    if (resolved) {
      for (const [row, sub] of resolved) {
        if (sub.contactId) resolvedContact.set(row, sub.contactId)
        if (sub.companyId) resolvedCompany.set(row, sub.companyId)
      }
    }

    const contact = ctx.contactMeta
      ? await this.writeSub(
          CONTACT_ENTITY_TYPE_ID,
          'CONTACT',
          ctx.contactMappings,
          ctx.contactMeta,
          dataRows,
          ctx.writer,
          resolvedContact,
        )
      : { ids: resolvedContact, results: [], throttle: null }
    results.push(...contact.results)
    if (contact.throttle) throttle.push(contact.throttle)

    const company = ctx.companyMeta
      ? await this.writeSub(
          COMPANY_ENTITY_TYPE_ID,
          'COMPANY',
          ctx.companyMappings,
          ctx.companyMeta,
          dataRows,
          ctx.writer,
          resolvedCompany,
        )
      : { ids: resolvedCompany, results: [], throttle: null }
    results.push(...company.results)
    if (company.throttle) throttle.push(company.throttle)

    // COMPANY só aceita `contactIds[]` (singular `contactId` seria ignorado).
    const contactLinkPath =
      entityCode === 'COMPANY' ? ['contactIds', '0'] : ['contactId']
    const responsibleResolver = new ResponsibleResolver(ctx.bitrix)
    const responsiblePath =
      entityCode === 'TASK' ? ['RESPONSIBLE_ID'] : ['assignedById']

    const mainMapped = await Promise.all(
      dataRows.map(async r => {
        const m = mapRow(
          r.values,
          ctx.mainMappings,
          ctx.meta.metas,
          ctx.meta.statusLists,
        )
        const contactId = contact.ids.get(r.row)
        const companyId = company.ids.get(r.row)
        if (contactId)
          m.params.push({ path: contactLinkPath, value: contactId })
        if (companyId) m.params.push({ path: ['companyId'], value: companyId })
        if (config.responsible) {
          const raw = r.values[config.responsible.columnIndex] ?? ''
          const userId = await responsibleResolver.resolve(
            config.responsible.matchBy,
            raw,
          )
          if (userId) m.params.push({ path: responsiblePath, value: userId })
        }
        return { row: r.row, ...m }
      }),
    )

    const write = await ctx.writer.writePage(
      entityCode,
      entityTypeId,
      categoryId,
      mainMapped,
    )
    results.push(...write.results)
    if (write.throttle) throttle.push(write.throttle)

    const subIds = new Map<number, ResolvedSub>()
    for (const [row, id] of contact.ids) subIds.set(row, { contactId: id })
    for (const [row, id] of company.ids) {
      subIds.set(row, { ...subIds.get(row), companyId: id })
    }

    return { results, throttle, subIds }
  }

  private serializePartial(
    cursorRow: number,
    errorRows: ImportErrorRow[],
  ): string | null {
    return errorRows.length > 0
      ? serializeImportError({ kind: 'partial', cursorRow, rows: errorRows })
      : null
  }

  private existingErrorRows(imp: ImportSheetImport): ImportErrorRow[] {
    const parsed = parseImportError(imp.lastError)
    if (!parsed) return []
    // Fatal também pode carregar rows acumuladas (preservadas no catch do run).
    return parsed.kind === 'partial' ? parsed.rows : (parsed.rows ?? [])
  }

  private tabTitleCacheKey(importId: number): string {
    return `importsheet:tabtitle:${importId}`
  }

  private async invalidateTabTitleCache(importId: number): Promise<void> {
    try {
      await redisConnection.del(this.tabTitleCacheKey(importId))
    } catch {
      // falha de cache não quebra o run
    }
  }

  private async resolveTabTitle(imp: ImportSheetImport): Promise<string> {
    try {
      const cached = await redisConnection.get(this.tabTitleCacheKey(imp.id))
      if (cached) return cached
    } catch {
      // miss → resolve normal
    }

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
      await this.invalidateTabTitleCache(imp.id)
    }

    try {
      await redisConnection.set(
        this.tabTitleCacheKey(imp.id),
        tab.title,
        'EX',
        TAB_TITLE_TTL_SECONDS,
      )
    } catch {
      // falha de cache não quebra o run
    }
    return tab.title
  }

  private async finishImport(
    imp: ImportSheetImport,
    finalRow: number,
    errorRows: ImportErrorRow[],
  ): Promise<ImportRunOutcome> {
    const status = errorRows.length > 0 ? 'partial' : 'success'
    const nextRunAt = resolveSchedule(this.toSchedule(imp)).nextRunAt

    await this.repository.markRunResult(imp.id, {
      startRow: finalRow,
      lastRunAt: new Date(),
      lastRunStatus: status,
      lastError: this.serializePartial(finalRow, errorRows),
      nextRunAt,
    })

    await this.clearPageMarker(imp.id, imp.startRow)

    if (status === 'partial') {
      await this.notifyErrors(imp, errorRows.length)
    }

    apiLogger.info(
      { app: 'importsheet', importId: imp.id, status, startRow: finalRow },
      'Import run finished',
    )
    return { status: 'done' }
  }

  /**
   * Notifica (best-effort) os usuários configurados quando a importação termina
   * com erro. Lista app-level via app.option (com cache). Nunca quebra o run.
   *
   * Anti-spam: um import agendado que falha/erra a cada run (planilha sumida,
   * token, 3 linhas ruins fixas) notificaria toda execução. Cooldown por import
   * limita a 1 notificação por janela; erro novo após a janela volta a notificar.
   */
  private async notifyErrors(
    imp: ImportSheetImport,
    errorCount: number,
    fatalMessage?: string,
  ): Promise<void> {
    if (errorCount === 0 && !fatalMessage) return
    try {
      if (await this.notifyOnCooldown(imp.id)) return

      const bitrix = await this.makeBitrix(imp.appId)
      const settings = new NotifySettingsService(
        new BitrixAppOptionService(bitrix),
        imp.appId,
      )
      const userIds = await settings.get()
      if (userIds.length === 0) return

      const notifier = new BitrixSystemNotificationService(bitrix)
      const message = fatalMessage
        ? `[B]ImportSheet — Falha na importação[/B]\nA importação "${imp.title}" falhou: ${fatalMessage}` +
          (errorCount > 0 ? `\n${errorCount} linha(s) com erro.` : '')
        : `[B]ImportSheet — Erros na importação[/B]\nA importação "${imp.title}" terminou com ${errorCount} linha(s) com erro.`
      const tag = `importsheet_err_${imp.id}`

      for (const userId of userIds) {
        await notifier.notify({ userId, message, tag })
      }
      await this.markNotifyCooldown(imp.id)
    } catch (error) {
      apiLogger.warn(
        { app: 'importsheet', importId: imp.id, error },
        'Failed to notify import errors',
      )
    }
  }

  private notifyCooldownKey(importId: number): string {
    return `importsheet:notify:cooldown:${importId}`
  }

  private async notifyOnCooldown(importId: number): Promise<boolean> {
    try {
      const exists = await redisConnection.exists(
        this.notifyCooldownKey(importId),
      )
      return exists === 1
    } catch {
      return false // falha de cache não suprime a notificação
    }
  }

  private async markNotifyCooldown(importId: number): Promise<void> {
    try {
      await redisConnection.set(
        this.notifyCooldownKey(importId),
        '1',
        'EX',
        NOTIFY_COOLDOWN_SECONDS,
      )
    } catch {
      // sem cooldown persistido → pior caso re-notifica; aceitável
    }
  }

  private pageMarkerKey(importId: number, fromRow: number): string {
    return `importsheet:page:${importId}:${fromRow}`
  }

  private async peekPageMarker(
    importId: number,
    fromRow: number,
  ): Promise<WrittenPageMarker | null> {
    try {
      const raw = await redisConnection.get(
        this.pageMarkerKey(importId, fromRow),
      )
      if (!raw) return null
      const marker = JSON.parse(raw) as WrittenPageMarker
      // Marker legado (pré-deploy) não tinha errorRows.
      marker.errorRows ??= []
      return marker
    } catch {
      return null
    }
  }

  private async setPageMarker(
    importId: number,
    fromRow: number,
    marker: WrittenPageMarker,
  ): Promise<void> {
    try {
      await redisConnection.set(
        this.pageMarkerKey(importId, fromRow),
        JSON.stringify(marker),
        'EX',
        PAGE_MARKER_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { app: 'importsheet', importId, fromRow, error },
        'Failed to persist written-page marker (idempotency degraded)',
      )
    }
  }

  private async clearPageMarker(
    importId: number,
    fromRow: number,
  ): Promise<void> {
    try {
      await redisConnection.del(this.pageMarkerKey(importId, fromRow))
    } catch {
      // marcador órfão expira pelo TTL
    }
  }

  private async replayPage(
    imp: ImportSheetImport,
    marker: WrittenPageMarker,
  ): Promise<ImportRunOutcome> {
    apiLogger.warn(
      { app: 'importsheet', importId: imp.id, fromRow: imp.startRow },
      'Page already written in a prior attempt — advancing cursor (idempotency)',
    )
    if (!marker.hasMore) {
      return this.finishImport(imp, marker.nextRow, marker.errorRows)
    }
    await this.repository.markRunResult(imp.id, {
      startRow: marker.nextRow,
      lastRunAt: new Date(),
      lastRunStatus: 'running',
      lastError: this.serializePartial(marker.nextRow, marker.errorRows),
      nextRunAt: imp.nextRunAt,
    })
    await this.clearPageMarker(imp.id, imp.startRow)
    return { status: 'continue' }
  }

  /**
   * Cria/atualiza uma sub-entidade (contato/empresa) pra a página e devolve o
   * id por linha (pra vincular no principal), os resultados e o throttle.
   */
  private async writeSub(
    entityTypeId: number,
    entityCode: EntityCode,
    mappings: ImportConfigMapping[],
    meta: FieldMetaResult,
    dataRows: { row: number; values: string[] }[],
    writer: BitrixImportWriter,
    resolvedIds: Map<number, string>,
  ): Promise<{
    ids: Map<number, string>
    results: RowResult[]
    throttle: ThrottleSignal | null
  }> {
    // Começa com os ids já resolvidos (reprocess) e só escreve quem falta.
    const ids = new Map<number, string>(resolvedIds)
    const mapped = dataRows
      .filter(r => !resolvedIds.has(r.row))
      .map(r => ({
        row: r.row,
        ...mapRow(r.values, mappings, meta.metas, meta.statusLists),
      }))
      .filter(m => m.params.length > 0)

    if (mapped.length === 0) return { ids, results: [], throttle: null }

    const write = await writer.writePage(entityCode, entityTypeId, null, mapped)
    for (const result of write.results) {
      if (result.id) ids.set(result.row, result.id)
    }
    return { ids, results: write.results, throttle: write.throttle }
  }

  private async loadMeta(
    bitrix: BitrixClient,
    appId: string,
    entityCode: ImportSheetImport['config']['target']['entityCode'],
    entityTypeId: number | null,
  ): Promise<FieldMetaResult> {
    if (entityCode === 'TASK') return loadTaskFieldMeta(bitrix, appId)
    if (entityCode === 'FEED') return { metas: new Map(), statusLists: {} }
    return loadCrmFieldMeta(bitrix, appId, entityTypeId ?? 0)
  }

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
