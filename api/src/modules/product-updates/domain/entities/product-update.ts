import {
  ProductUpdateContent,
  sameProductUpdateContent,
} from './product-update-content'

export type ProductUpdateProgress = 'PENDING' | 'DONE'
export type ProductUpdateVisibility = 'DRAFT' | 'PUBLISHED'

/**
 * Novidade do ThinkZap. Conclusão (`progress`, que pode vir da tarefa do Bitrix) e
 * visibilidade (decisão humana) mudam de forma independente; a situação mostrada
 * nas telas é derivada delas (`productUpdateSituation`), nunca gravada.
 *
 * `createdBy`, `publishedBy` e `completedBy` são ids de `PortalUser`. `completedBy`
 * fica nulo quando a conclusão veio da tarefa.
 */
export type ProductUpdate = {
  id: string
  /** Versão em edição. */
  content: ProductUpdateContent
  /** O que o cliente vê. Nulo até a primeira publicação. */
  publishedContent: ProductUpdateContent | null
  progress: ProductUpdateProgress
  doneAt: Date | null
  completedBy: string | null
  visibility: ProductUpdateVisibility
  /** Nunca volta a nulo: trava a exclusão. */
  firstPublishedAt: Date | null
  /** Última vez que `publishedContent` foi gravado (publicar ou publicar alterações). */
  publishedAt: Date | null
  publishedBy: string | null
  /** Data em "Já disponível". Mantida ao despublicar. */
  availableAt: Date | null
  /** Tarefa do portal da CRMThink e o último estado lido dela (cache para a tela). */
  bitrixTaskId: number | null
  bitrixTaskTitle: string | null
  bitrixTaskStatus: number | null
  bitrixTaskGroupId: number | null
  bitrixTaskSyncedAt: Date | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export const PRODUCT_UPDATE_SITUATIONS = [
  'draft',
  'soon',
  'awaiting-review',
  'available',
] as const

/**
 * - `draft` (Rascunho): não publicada — o cliente não vê;
 * - `soon` (Em breve): publicada, pendente;
 * - `awaiting-review` (Aguardando revisão): publicada e concluída, ainda não
 *   disponível — o cliente segue vendo em "Em breve";
 * - `available` (Disponível): publicada como disponível.
 */
export type ProductUpdateSituation = (typeof PRODUCT_UPDATE_SITUATIONS)[number]

export function isProductUpdateSituation(
  value: unknown,
): value is ProductUpdateSituation {
  return (PRODUCT_UPDATE_SITUATIONS as readonly unknown[]).includes(value)
}

type SituationFields = Pick<
  ProductUpdate,
  'visibility' | 'progress' | 'availableAt'
>

export function productUpdateSituation(
  update: SituationFields,
): ProductUpdateSituation {
  if (update.visibility === 'DRAFT') return 'draft'
  if (update.availableAt) return 'available'
  if (update.progress === 'DONE') return 'awaiting-review'
  return 'soon'
}

/** Publicada com a versão em edição diferente da que o cliente vê. */
export function hasPendingChanges(
  update: Pick<ProductUpdate, 'visibility' | 'content' | 'publishedContent'>,
): boolean {
  if (update.visibility !== 'PUBLISHED') return false
  if (!update.publishedContent) return true
  return !sameProductUpdateContent(update.content, update.publishedContent)
}
