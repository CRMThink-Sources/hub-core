import type { ProductUpdate } from '../../domain/entities/product-update'
import {
  ProductUpdateContent,
  cloneProductUpdateContent,
  emptyProductUpdateContent,
} from '../../domain/entities/product-update-content'
import { TaskAlreadyLinkedError } from '../../domain/errors/product-update.errors'
import type { ProductUpdateRepository } from '../../domain/repositories/product-update.repository'

const clone = (update: ProductUpdate): ProductUpdate => ({
  ...update,
  content: cloneProductUpdateContent(update.content),
  publishedContent: update.publishedContent
    ? cloneProductUpdateContent(update.publishedContent)
    : null,
})

/**
 * Repositório de mentira para os testes dos casos de uso. Guarda cópias (como o
 * banco, mutar o objeto devolvido não altera o gravado) e reproduz o índice único
 * de `bitrix_task_id`.
 */
export class InMemoryProductUpdateRepository implements ProductUpdateRepository {
  readonly rows = new Map<string, ProductUpdate>()

  constructor(
    initial: ProductUpdate[] = [],
    private readonly now: () => Date = () => new Date(),
  ) {
    for (const update of initial) this.rows.set(update.id, clone(update))
  }

  findById(id: string): Promise<ProductUpdate | null> {
    const row = this.rows.get(id)
    return Promise.resolve(row ? clone(row) : null)
  }

  list(): Promise<ProductUpdate[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(clone),
    )
  }

  listPublished(): Promise<ProductUpdate[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter(r => r.visibility === 'PUBLISHED')
        .map(clone),
    )
  }

  findByBitrixTaskId(taskId: number): Promise<ProductUpdate | null> {
    const row = [...this.rows.values()].find(r => r.bitrixTaskId === taskId)
    return Promise.resolve(row ? clone(row) : null)
  }

  listReconcilable(): Promise<ProductUpdate[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter(r => r.bitrixTaskId !== null && r.availableAt === null)
        .map(clone),
    )
  }

  save(update: ProductUpdate): Promise<ProductUpdate> {
    if (update.bitrixTaskId !== null) {
      const owner = [...this.rows.values()].find(
        r => r.bitrixTaskId === update.bitrixTaskId && r.id !== update.id,
      )
      if (owner) {
        return Promise.reject(
          new TaskAlreadyLinkedError(update.bitrixTaskId, owner.id),
        )
      }
    }
    const saved = clone({ ...update, updatedAt: this.now() })
    this.rows.set(update.id, saved)
    return Promise.resolve(clone(saved))
  }

  delete(id: string): Promise<void> {
    this.rows.delete(id)
    return Promise.resolve()
  }
}

/** Novidade de teste: rascunho pendente, vazio, sem tarefa — sobrescreva o que importa. */
export function buildProductUpdate(
  overrides: Partial<ProductUpdate> = {},
): ProductUpdate {
  return {
    id: 'pu-1',
    content: emptyProductUpdateContent(),
    publishedContent: null,
    progress: 'PENDING',
    doneAt: null,
    completedBy: null,
    visibility: 'DRAFT',
    firstPublishedAt: null,
    publishedAt: null,
    publishedBy: null,
    availableAt: null,
    bitrixTaskId: null,
    bitrixTaskTitle: null,
    bitrixTaskStatus: null,
    bitrixTaskGroupId: null,
    bitrixTaskSyncedAt: null,
    createdBy: 'portal-user-1',
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    updatedAt: new Date('2026-10-01T12:00:00.000Z'),
    ...overrides,
  }
}

/** Conteúdo com os três idiomas preenchidos. */
export function completeProductUpdateContent(
  imageKey: string | null = null,
): ProductUpdateContent {
  return {
    pt: { title: 'Envio de template', description: 'Agora com imagem.' },
    en: { title: 'Template sending', description: 'Now with images.' },
    es: { title: 'Envío de plantilla', description: 'Ahora con imagen.' },
    imageKey,
  }
}
