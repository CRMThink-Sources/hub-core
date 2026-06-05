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
        config: params.config as object,
        scheduleMode: params.scheduleMode,
        everyHours: params.everyHours,
        weekdays: params.weekdays ?? Prisma.JsonNull,
        nextRunAt: params.nextRunAt,
      },
    })
    return this.toDomain(record)
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
