import { Prisma } from '@/prisma/client'
import type { ImportSheetImport as PrismaImportSheetImport } from '@/prisma/client'
import { prisma } from '@/config/prisma.js'
import type {
  ImportConfig,
  ImportSheetImport,
} from '@/modules/importsheet/domain/entities/import'
import type {
  CreateImportSheetImportParams,
  UpdateImportSheetImportParams,
  MarkRunResultParams,
  ImportSheetImportRepository,
} from '@/modules/importsheet/domain/repositories/importsheet-import.repository'

export class PrismaImportSheetImportRepository implements ImportSheetImportRepository {
  async create(
    params: CreateImportSheetImportParams,
  ): Promise<ImportSheetImport> {
    const record = await prisma.importSheetImport.create({
      data: {
        appId: params.appId,
        title: params.title,
        config: params.config as object,
        startRow: params.startRow,
        scheduleMode: params.scheduleMode,
        everyHours: params.everyHours,
        weekdays: params.weekdays ?? Prisma.JsonNull,
        nextRunAt: params.nextRunAt,
      },
    })
    return this.toDomain(record)
  }

  async list(appId: string): Promise<ImportSheetImport[]> {
    const records = await prisma.importSheetImport.findMany({
      where: { appId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(record => this.toDomain(record))
  }

  async findById(id: number, appId: string): Promise<ImportSheetImport | null> {
    const record = await prisma.importSheetImport.findFirst({
      where: { id, appId },
    })
    return record ? this.toDomain(record) : null
  }

  async findByIdAny(id: number): Promise<ImportSheetImport | null> {
    const record = await prisma.importSheetImport.findUnique({ where: { id } })
    return record ? this.toDomain(record) : null
  }

  async findDue(now: Date): Promise<ImportSheetImport[]> {
    const records = await prisma.importSheetImport.findMany({
      where: {
        enabled: true,
        // nextRunAt null = MANUAL (roda só sob demanda) → excluído do poller.
        nextRunAt: { not: null, lte: now },
      },
      orderBy: { nextRunAt: 'asc' },
    })
    return records.map(record => this.toDomain(record))
  }

  async findStaleRunning(olderThan: Date): Promise<ImportSheetImport[]> {
    const records = await prisma.importSheetImport.findMany({
      where: {
        lastRunStatus: 'running',
        lastRunAt: { lt: olderThan },
      },
    })
    return records.map(record => this.toDomain(record))
  }

  async update(
    id: number,
    appId: string,
    params: UpdateImportSheetImportParams,
  ): Promise<ImportSheetImport | null> {
    // Escopo por appId — só atualiza se a importação pertence ao app.
    const owned = await prisma.importSheetImport.findFirst({
      where: { id, appId },
      select: { id: true },
    })
    if (!owned) return null

    const record = await prisma.importSheetImport.update({
      where: { id },
      data: {
        title: params.title,
        startRow: params.startRow,
        config: params.config as object,
        scheduleMode: params.scheduleMode,
        everyHours: params.everyHours,
        weekdays: params.weekdays ?? Prisma.JsonNull,
        nextRunAt: params.nextRunAt,
      },
    })
    return this.toDomain(record)
  }

  async setEnabled(
    id: number,
    appId: string,
    enabled: boolean,
  ): Promise<ImportSheetImport | null> {
    // Escopo por appId — só altera se a importação pertence ao app.
    const owned = await prisma.importSheetImport.findFirst({
      where: { id, appId },
      select: { id: true },
    })
    if (!owned) return null

    const record = await prisma.importSheetImport.update({
      where: { id },
      data: { enabled },
    })
    return this.toDomain(record)
  }

  async updateTabTitle(id: number, title: string): Promise<void> {
    const record = await prisma.importSheetImport.findUnique({ where: { id } })
    if (!record) return
    const config = record.config as unknown as ImportConfig
    config.source.tab.title = title
    await prisma.importSheetImport.update({
      where: { id },
      data: { config: config as object },
    })
  }

  async markRunResult(id: number, params: MarkRunResultParams): Promise<void> {
    await prisma.importSheetImport.update({
      where: { id },
      data: {
        startRow: params.startRow,
        lastRunAt: params.lastRunAt,
        lastRunStatus: params.lastRunStatus,
        lastError: params.lastError,
        nextRunAt: params.nextRunAt,
        ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
      },
    })
  }

  async delete(id: number, appId: string): Promise<boolean> {
    const deleted = await prisma.importSheetImport.deleteMany({
      where: { id, appId },
    })
    return deleted.count > 0
  }

  private toDomain(record: PrismaImportSheetImport): ImportSheetImport {
    return {
      id: record.id,
      appId: record.appId,
      title: record.title,
      config: record.config as unknown as ImportConfig,
      startRow: record.startRow,
      scheduleMode: record.scheduleMode as ImportSheetImport['scheduleMode'],
      everyHours: record.everyHours,
      weekdays: record.weekdays as number[] | null,
      nextRunAt: record.nextRunAt,
      enabled: record.enabled,
      lastRunAt: record.lastRunAt,
      lastRunStatus: record.lastRunStatus,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
