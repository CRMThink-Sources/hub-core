import type {
  ImportConfig,
  ImportScheduleMode,
  ImportSheetImport,
} from '../entities/import'

export type CreateImportSheetImportParams = {
  appId: string
  title: string
  config: ImportConfig
  startRow: number
  scheduleMode: ImportScheduleMode
  everyHours: number | null
  weekdays: number[] | null
  nextRunAt: Date | null
}

export type UpdateImportSheetImportParams = Omit<
  CreateImportSheetImportParams,
  'appId'
>

/** Estado gravado após uma execução do worker. */
export type MarkRunResultParams = {
  startRow: number
  lastRunAt: Date
  lastRunStatus: string
  lastError: string | null
  nextRunAt: Date | null
}

export interface ImportSheetImportRepository {
  create(params: CreateImportSheetImportParams): Promise<ImportSheetImport>
  list(appId: string): Promise<ImportSheetImport[]>
  findById(id: number, appId: string): Promise<ImportSheetImport | null>
  /** Sem escopo de appId — uso interno do worker (fora do contexto HTTP). */
  findByIdAny(id: number): Promise<ImportSheetImport | null>
  /** Importações agendadas vencidas: enabled && nextRunAt != null && nextRunAt <= now. */
  findDue(now: Date): Promise<ImportSheetImport[]>
  update(
    id: number,
    appId: string,
    params: UpdateImportSheetImportParams,
  ): Promise<ImportSheetImport | null>
  /** Ativa/pausa a importação (escopo por appId). Pausada = fora do poller + run manual no-op. */
  setEnabled(
    id: number,
    appId: string,
    enabled: boolean,
  ): Promise<ImportSheetImport | null>
  /** Atualiza só o título da aba no config (uso do worker quando a aba é renomeada). */
  updateTabTitle(id: number, title: string): Promise<void>
  markRunResult(id: number, params: MarkRunResultParams): Promise<void>
  delete(id: number, appId: string): Promise<boolean>
}
