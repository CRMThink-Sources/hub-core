import { prisma } from '@/config/prisma.js'
import { Prisma } from '@/prisma/client'
import type { ProductUpdate } from '../../domain/entities/product-update'
import {
  ProductUpdateContent,
  parseProductUpdateContent,
} from '../../domain/entities/product-update-content'
import { TaskAlreadyLinkedError } from '../../domain/errors/product-update.errors'
import type { ProductUpdateRepository } from '../../domain/repositories/product-update.repository'

type ProductUpdateRow = {
  id: string
  content: Prisma.JsonValue
  publishedContent: Prisma.JsonValue | null
  progress: 'PENDING' | 'DONE'
  doneAt: Date | null
  completedBy: string | null
  visibility: 'DRAFT' | 'PUBLISHED'
  firstPublishedAt: Date | null
  publishedAt: Date | null
  publishedBy: string | null
  availableAt: Date | null
  bitrixTaskId: number | null
  bitrixTaskTitle: string | null
  bitrixTaskStatus: number | null
  bitrixTaskGroupId: number | null
  bitrixTaskSyncedAt: Date | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

function toProductUpdate(row: ProductUpdateRow): ProductUpdate {
  return {
    id: row.id,
    content: parseProductUpdateContent(row.content),
    publishedContent:
      row.publishedContent === null
        ? null
        : parseProductUpdateContent(row.publishedContent),
    progress: row.progress,
    doneAt: row.doneAt,
    completedBy: row.completedBy,
    visibility: row.visibility,
    firstPublishedAt: row.firstPublishedAt,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
    availableAt: row.availableAt,
    bitrixTaskId: row.bitrixTaskId,
    bitrixTaskTitle: row.bitrixTaskTitle,
    bitrixTaskStatus: row.bitrixTaskStatus,
    bitrixTaskGroupId: row.bitrixTaskGroupId,
    bitrixTaskSyncedAt: row.bitrixTaskSyncedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

const json = (content: ProductUpdateContent): Prisma.InputJsonValue =>
  content as unknown as Prisma.InputJsonValue

/** Campos graváveis — `id`, `createdAt` e `updatedAt` ficam com o banco. */
function toData(update: ProductUpdate) {
  return {
    content: json(update.content),
    publishedContent: update.publishedContent
      ? json(update.publishedContent)
      : Prisma.DbNull,
    progress: update.progress,
    doneAt: update.doneAt,
    completedBy: update.completedBy,
    visibility: update.visibility,
    firstPublishedAt: update.firstPublishedAt,
    publishedAt: update.publishedAt,
    publishedBy: update.publishedBy,
    availableAt: update.availableAt,
    bitrixTaskId: update.bitrixTaskId,
    bitrixTaskTitle: update.bitrixTaskTitle,
    bitrixTaskStatus: update.bitrixTaskStatus,
    bitrixTaskGroupId: update.bitrixTaskGroupId,
    bitrixTaskSyncedAt: update.bitrixTaskSyncedAt,
    createdBy: update.createdBy,
  }
}

/**
 * P2002 é "unique constraint failed". O único índice único além da chave do upsert
 * é `bitrix_task_id`; ainda assim, quando o driver informa `meta.target`, ele é
 * conferido para não mascarar outra violação.
 */
function isTaskUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const { code, meta } = error as { code?: string; meta?: { target?: unknown } }
  if (code !== 'P2002') return false

  const target = meta?.target
  if (target === undefined) return true
  const fields = Array.isArray(target) ? target : [target]

  return fields.some(
    field => typeof field === 'string' && field.includes('bitrix_task_id'),
  )
}

export class PrismaProductUpdateRepository implements ProductUpdateRepository {
  async findById(id: string): Promise<ProductUpdate | null> {
    const row = await prisma.productUpdate.findUnique({ where: { id } })
    return row ? toProductUpdate(row) : null
  }

  async list(): Promise<ProductUpdate[]> {
    const rows = await prisma.productUpdate.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toProductUpdate)
  }

  async findByBitrixTaskId(taskId: number): Promise<ProductUpdate | null> {
    const row = await prisma.productUpdate.findUnique({
      where: { bitrixTaskId: taskId },
    })
    return row ? toProductUpdate(row) : null
  }

  async listReconcilable(): Promise<ProductUpdate[]> {
    const rows = await prisma.productUpdate.findMany({
      where: { bitrixTaskId: { not: null }, availableAt: null },
      orderBy: { bitrixTaskId: 'asc' },
    })
    return rows.map(toProductUpdate)
  }

  async save(update: ProductUpdate): Promise<ProductUpdate> {
    const data = toData(update)

    try {
      const row = await prisma.productUpdate.upsert({
        where: { id: update.id },
        create: { id: update.id, createdAt: update.createdAt, ...data },
        update: data,
      })
      return toProductUpdate(row)
    } catch (error) {
      if (update.bitrixTaskId !== null && isTaskUniqueViolation(error)) {
        const owner = await this.findByBitrixTaskId(update.bitrixTaskId)
        throw new TaskAlreadyLinkedError(update.bitrixTaskId, owner?.id ?? null)
      }
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.productUpdate.delete({ where: { id } })
  }
}
