import { isAwaitingTaskApproval } from '../domain/apply-task-status'
import {
  ProductUpdate,
  ProductUpdateSituation,
  hasPendingChanges,
  productUpdateSituation,
} from '../domain/entities/product-update'
import {
  ProductUpdateContent,
  ProductUpdateLocale,
  missingLocales,
} from '../domain/entities/product-update-content'

/** Tarefa vinculada como a tela a mostra: o último estado lido do Bitrix. */
export type ProductUpdateTaskView = {
  id: number
  title: string | null
  status: number | null
  groupId: number | null
  syncedAt: Date | null
  /** Conclusão enviada e parada na aprovação do criador ("aguardando controle"). */
  awaitingApproval: boolean
}

export type ProductUpdateListItem = {
  id: string
  /** Título em português, a referência do time. */
  title: string
  situation: ProductUpdateSituation
  hasPendingChanges: boolean
  progress: ProductUpdate['progress']
  availableAt: Date | null
  publishedAt: Date | null
  task: ProductUpdateTaskView | null
  createdAt: Date
  updatedAt: Date
}

export type ProductUpdateContentView = ProductUpdateContent & {
  imageUrl: string | null
}

export type ProductUpdateView = Omit<
  ProductUpdate,
  | 'content'
  | 'publishedContent'
  | 'bitrixTaskId'
  | 'bitrixTaskTitle'
  | 'bitrixTaskStatus'
  | 'bitrixTaskGroupId'
  | 'bitrixTaskSyncedAt'
> & {
  content: ProductUpdateContentView
  publishedContent: ProductUpdateContentView | null
  situation: ProductUpdateSituation
  hasPendingChanges: boolean
  /** Idiomas incompletos na versão em edição — as abas marcadas na tela. */
  missingLocales: ProductUpdateLocale[]
  task: ProductUpdateTaskView | null
}

/** URL pública de uma chave de imagem (`null` sem imagem ou sem R2). */
export type ProductUpdateImageUrlResolver = (
  key: string | null,
) => string | null

export function toProductUpdateTaskView(
  update: ProductUpdate,
): ProductUpdateTaskView | null {
  if (update.bitrixTaskId === null) return null
  return {
    id: update.bitrixTaskId,
    title: update.bitrixTaskTitle,
    status: update.bitrixTaskStatus,
    groupId: update.bitrixTaskGroupId,
    syncedAt: update.bitrixTaskSyncedAt,
    awaitingApproval: isAwaitingTaskApproval(update),
  }
}

export function toProductUpdateListItem(
  update: ProductUpdate,
): ProductUpdateListItem {
  return {
    id: update.id,
    title: update.content.pt.title,
    situation: productUpdateSituation(update),
    hasPendingChanges: hasPendingChanges(update),
    progress: update.progress,
    availableAt: update.availableAt,
    publishedAt: update.publishedAt,
    task: toProductUpdateTaskView(update),
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
  }
}

/** Resposta do detalhe e das ações do backoffice: entidade + derivações + URLs. */
export function toProductUpdateView(
  update: ProductUpdate,
  imageUrl: ProductUpdateImageUrlResolver,
): ProductUpdateView {
  const {
    bitrixTaskId: _id,
    bitrixTaskTitle: _title,
    bitrixTaskStatus: _status,
    bitrixTaskGroupId: _group,
    bitrixTaskSyncedAt: _synced,
    ...rest
  } = update

  return {
    ...rest,
    content: { ...update.content, imageUrl: imageUrl(update.content.imageKey) },
    publishedContent: update.publishedContent
      ? {
          ...update.publishedContent,
          imageUrl: imageUrl(update.publishedContent.imageKey),
        }
      : null,
    situation: productUpdateSituation(update),
    hasPendingChanges: hasPendingChanges(update),
    missingLocales: missingLocales(update.content),
    task: toProductUpdateTaskView(update),
  }
}
