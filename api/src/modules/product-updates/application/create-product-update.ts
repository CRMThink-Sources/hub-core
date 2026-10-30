import { randomUUID } from 'node:crypto'
import type { ProductUpdate } from '../domain/entities/product-update'
import { parseProductUpdateTexts } from '../domain/entities/product-update-content'
import type { ProductUpdateRepository } from '../domain/repositories/product-update.repository'
import { Clock, logProductUpdateAction } from './helpers/product-update-actions'

export type CreateProductUpdateInput = {
  portalUserId: string
  /** Textos por idioma; qualquer um pode faltar — nasce rascunho. */
  texts?: unknown
}

/** Nova novidade: sempre rascunho pendente, sem imagem e sem tarefa. */
export class CreateProductUpdate {
  constructor(
    private readonly repository: ProductUpdateRepository,
    private readonly now: Clock = () => new Date(),
    private readonly newId: () => string = randomUUID,
  ) {}

  async execute(input: CreateProductUpdateInput): Promise<ProductUpdate> {
    const texts = parseProductUpdateTexts(input.texts)
    const now = this.now()

    const created = await this.repository.save({
      id: this.newId(),
      content: { ...texts, imageKey: null },
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
      createdBy: input.portalUserId,
      createdAt: now,
      updatedAt: now,
    })

    logProductUpdateAction('create', created, input.portalUserId)
    return created
  }
}
