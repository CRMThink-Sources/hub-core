import { axiosPortal } from '@/infra/client/axios-portal'

/**
 * Novidades do ThinkZap no backoffice (`/api/portal/novidades`): tipos do contrato, as
 * chamadas e as regras puras que as telas usam (filtro, ações por situação, leitura de
 * erro). Espelha `api/src/modules/product-updates/application/product-update-view.ts`.
 */

export const PRODUCT_UPDATE_LOCALES = ['pt', 'en', 'es'] as const
export type ProductUpdateLocale = (typeof PRODUCT_UPDATE_LOCALES)[number]

export const PRODUCT_UPDATE_SITUATIONS = [
  'draft',
  'soon',
  'awaiting-review',
  'available',
] as const
export type ProductUpdateSituation = (typeof PRODUCT_UPDATE_SITUATIONS)[number]

/** Os mesmos tetos da api (`PRODUCT_UPDATE_TITLE_MAX`/`_DESCRIPTION_MAX`). */
export const PRODUCT_UPDATE_TITLE_MAX = 200
export const PRODUCT_UPDATE_DESCRIPTION_MAX = 5000
/** Teto do upload (multer da api): PNG ou JPEG até 5 MB. */
export const PRODUCT_UPDATE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const PRODUCT_UPDATE_IMAGE_TYPES = ['image/png', 'image/jpeg'] as const

export type ProductUpdateLocalizedText = { title: string; description: string }
export type ProductUpdateTexts = Record<
  ProductUpdateLocale,
  ProductUpdateLocalizedText
>

export type ProductUpdateContent = ProductUpdateTexts & {
  imageKey: string | null
  imageUrl: string | null
}

/** Tarefa vinculada: o último estado lido do Bitrix (cache para a tela). */
export type ProductUpdateTask = {
  id: number
  title: string | null
  status: number | null
  groupId: number | null
  syncedAt: string | null
  /** Conclusão enviada e parada na aprovação do criador ("aguardando controle"). */
  awaitingApproval: boolean
}

export type ProductUpdateListItem = {
  id: string
  /** Título em português. */
  title: string
  situation: ProductUpdateSituation
  hasPendingChanges: boolean
  progress: 'PENDING' | 'DONE'
  availableAt: string | null
  publishedAt: string | null
  task: ProductUpdateTask | null
  createdAt: string
  updatedAt: string
}

export type ProductUpdateView = {
  id: string
  /** Versão em edição. */
  content: ProductUpdateContent
  /** O que o cliente vê; `null` até a primeira publicação. */
  publishedContent: ProductUpdateContent | null
  progress: 'PENDING' | 'DONE'
  doneAt: string | null
  completedBy: string | null
  visibility: 'DRAFT' | 'PUBLISHED'
  firstPublishedAt: string | null
  publishedAt: string | null
  publishedBy: string | null
  availableAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  situation: ProductUpdateSituation
  hasPendingChanges: boolean
  /** Idiomas incompletos na versão em edição (salva). */
  missingLocales: ProductUpdateLocale[]
  task: ProductUpdateTask | null
}

export type ListProductUpdatesResponse = {
  items: ProductUpdateListItem[]
  total: number
}

export type CompleteProductUpdateResponse = {
  update: ProductUpdateView
  /** A tarefa ficou "aguardando controle": a novidade segue pendente. */
  awaitingApproval: boolean
}

export type CrmthinkTaskSearchResult = {
  id: number
  title: string
  status: number
  groupId: number | null
  responsibleId: number | null
  responsibleName: string | null
  /** De outro projeto que não o configurado: aviso, mas vinculável. */
  outsideGroup: boolean
}

export type CrmthinkUser = { id: number; name: string; email: string | null }

const BASE = '/portal/novidades'
const byId = (id: string) => `${BASE}/${encodeURIComponent(id)}`

export const listProductUpdates = () =>
  axiosPortal().get<ListProductUpdatesResponse>(BASE)

export const getProductUpdate = (id: string) =>
  axiosPortal().get<ProductUpdateView>(byId(id))

export const createProductUpdate = (texts?: Partial<ProductUpdateTexts>) =>
  axiosPortal().post<ProductUpdateView>(BASE, texts ? { texts } : {})

export const updateProductUpdateTexts = (
  id: string,
  texts: ProductUpdateTexts,
) => axiosPortal().patch<ProductUpdateView>(byId(id), { texts })

export const deleteProductUpdate = (id: string) =>
  axiosPortal().delete<{ id: string }>(byId(id))

/**
 * O `Content-Type` explícito não vai para a rede: o navegador o troca pelo de
 * multipart com o boundary. Ele existe para o axios não serializar o `FormData`
 * como JSON, que é o que faria com o `application/json` padrão da instância.
 */
export function uploadProductUpdateImage(
  id: string,
  file: File,
): Promise<ProductUpdateView> {
  const form = new FormData()
  form.append('image', file)
  return axiosPortal().put<ProductUpdateView>(`${byId(id)}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const removeProductUpdateImage = (id: string) =>
  axiosPortal().delete<ProductUpdateView>(`${byId(id)}/image`)

/** Ações do ciclo de vida que só recebem a novidade e devolvem a view. */
export type ProductUpdateLifecycleAction =
  | 'publish'
  | 'publish-available'
  | 'publish-changes'
  | 'discard-changes'
  | 'unpublish'
  | 'reopen'

export const runProductUpdateAction = (
  id: string,
  action: ProductUpdateLifecycleAction,
) => axiosPortal().post<ProductUpdateView>(`${byId(id)}/${action}`)

export const completeProductUpdate = (id: string) =>
  axiosPortal().post<CompleteProductUpdateResponse>(`${byId(id)}/complete`)

export const linkProductUpdateTask = (id: string, taskId: number) =>
  axiosPortal().put<ProductUpdateView>(`${byId(id)}/task`, { taskId })

export const unlinkProductUpdateTask = (id: string) =>
  axiosPortal().delete<ProductUpdateView>(`${byId(id)}/task`)

export const createProductUpdateTask = (id: string, responsibleId: number) =>
  axiosPortal().post<ProductUpdateView>(`${byId(id)}/task`, { responsibleId })

export const searchCrmthinkTasks = (q: string) =>
  axiosPortal()
    .get<{ items: CrmthinkTaskSearchResult[] }>(`${BASE}/bitrix/tasks`, {
      params: { q },
    })
    .then(result => result.items)

export const searchCrmthinkUsers = (q: string) =>
  axiosPortal()
    .get<{ items: CrmthinkUser[] }>(`${BASE}/bitrix/users`, { params: { q } })
    .then(result => result.items)

// ---------------------------------------------------------------------------
// Regras puras
// ---------------------------------------------------------------------------

export type ProductUpdatesFilter = ProductUpdateSituation | 'all'

/** A lista na ordem da api, recortada pela situação escolhida. */
export function filterProductUpdates(
  items: readonly ProductUpdateListItem[],
  filter: ProductUpdatesFilter,
): ProductUpdateListItem[] {
  return filter === 'all'
    ? [...items]
    : items.filter(item => item.situation === filter)
}

/** Quantas há em cada situação (e no total), para as abas do filtro. */
export function countProductUpdatesBySituation(
  items: readonly ProductUpdateListItem[],
): Record<ProductUpdatesFilter, number> {
  const counts: Record<ProductUpdatesFilter, number> = {
    all: items.length,
    draft: 0,
    soon: 0,
    'awaiting-review': 0,
    available: 0,
  }
  for (const item of items) counts[item.situation]++
  return counts
}

/** Idioma incompleto = título ou descrição vazios (com trim, como a api). */
export function missingLocalesOf(
  texts: ProductUpdateTexts,
): ProductUpdateLocale[] {
  return PRODUCT_UPDATE_LOCALES.filter(
    locale => !texts[locale].title.trim() || !texts[locale].description.trim(),
  )
}

export const textsOf = (content: ProductUpdateContent): ProductUpdateTexts => ({
  pt: { ...content.pt },
  en: { ...content.en },
  es: { ...content.es },
})

/** O formulário difere do que está salvo (com trim, como a api compara). */
export function textsChanged(
  a: ProductUpdateTexts,
  b: ProductUpdateTexts,
): boolean {
  return PRODUCT_UPDATE_LOCALES.some(
    locale =>
      a[locale].title.trim() !== b[locale].title.trim() ||
      a[locale].description.trim() !== b[locale].description.trim(),
  )
}

export type ProductUpdateAction =
  | 'save'
  | 'publish'
  | 'publish-available'
  | 'publish-changes'
  | 'discard-changes'
  | 'unpublish'
  | 'complete'
  | 'reopen'
  | 'delete'

/** Ações que mudam o que o cliente vê, ou apagam: pedem confirmação. */
export const CONFIRMED_ACTIONS: ReadonlySet<ProductUpdateAction> = new Set([
  'publish',
  'publish-available',
  'publish-changes',
  'discard-changes',
  'unpublish',
  'delete',
])

/** Ações que publicam o texto salvo: o formulário sujo é salvo antes. */
export const PUBLISHING_ACTIONS: ReadonlySet<ProductUpdateAction> = new Set([
  'publish',
  'publish-available',
  'publish-changes',
])

type ActionFields = Pick<
  ProductUpdateView,
  | 'situation'
  | 'progress'
  | 'availableAt'
  | 'firstPublishedAt'
  | 'hasPendingChanges'
  | 'publishedContent'
>

/**
 * O que a edição oferece para a situação atual. Espelha as recusas da api
 * (`409`) para a tela não mostrar um botão que só serviria para recebê-las:
 *
 * - **Publicar** (em "Em breve"): rascunho que nunca foi disponível — um rascunho que
 *   já foi disponível volta por "Publicar como disponível", com a data original;
 * - **Publicar como disponível**: concluída e ainda não disponível;
 * - **Marcar como concluída** / **Desmarcar conclusão**: pendente / concluída fora de
 *   "Disponível";
 * - **Despublicar**: publicada;
 * - **Publicar/Descartar alterações**: publicada com a versão em edição diferente;
 * - **Excluir**: nunca publicada.
 *
 * Salvar existe sempre: numa publicada, o texto salvo fica pendente de revisão.
 */
export function availableActions(view: ActionFields): ProductUpdateAction[] {
  const actions: ProductUpdateAction[] = ['save']
  const published = view.situation !== 'draft'
  const done = view.progress === 'DONE'

  if (!published && !view.availableAt) actions.push('publish')
  if (done && view.situation !== 'available') actions.push('publish-available')
  if (view.hasPendingChanges) {
    actions.push('publish-changes')
    if (view.publishedContent) actions.push('discard-changes')
  }
  if (!done) actions.push('complete')
  if (done && view.situation !== 'available') actions.push('reopen')
  if (published) actions.push('unpublish')
  if (!view.firstPublishedAt) actions.push('delete')

  return actions
}

/**
 * Como o card vai aparecer para o cliente: "Já disponível" quando a novidade é (ou
 * volta a ser, ao republicar) disponível; "Em breve" no resto.
 */
export function previewStatus(
  view: Pick<ProductUpdateView, 'availableAt'>,
): 'available' | 'soon' {
  return view.availableAt ? 'available' : 'soon'
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export type ProductUpdateError = {
  status?: number
  reason?: string
  /** Mensagem da api (pt), útil como detalhe — ex.: o erro devolvido pelo Bitrix. */
  message?: string
  missingLocales: ProductUpdateLocale[]
  taskId?: number
  productUpdateId?: string | null
  issues: string[]
}

const isLocale = (value: unknown): value is ProductUpdateLocale =>
  (PRODUCT_UPDATE_LOCALES as readonly unknown[]).includes(value)

/**
 * Lê o erro de uma chamada de novidades. A api responde em duas formas: as recusas
 * dos casos de uso vêm em `{ result: { error, reason, ... } }`; o `401` do
 * middleware, o `422` do upload (multer) e o `500` vêm no topo (`{ error, reason }`).
 * Nunca lança: corpo inesperado vira só o status.
 */
export function readProductUpdateError(error: unknown): ProductUpdateError {
  const response = (
    error as { response?: { status?: unknown; data?: unknown } } | null
  )?.response
  const status =
    typeof response?.status === 'number' ? response.status : undefined
  const data =
    response?.data && typeof response.data === 'object'
      ? (response.data as Record<string, unknown>)
      : {}
  const wrapped =
    data.result && typeof data.result === 'object'
      ? (data.result as Record<string, unknown>)
      : null
  const body = wrapped ?? data

  return {
    status,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    message: typeof body.error === 'string' ? body.error : undefined,
    missingLocales: Array.isArray(body.missingLocales)
      ? body.missingLocales.filter(isLocale)
      : [],
    taskId: typeof body.taskId === 'number' ? body.taskId : undefined,
    productUpdateId:
      typeof body.productUpdateId === 'string'
        ? body.productUpdateId
        : body.productUpdateId === null
          ? null
          : undefined,
    issues: Array.isArray(body.issues)
      ? body.issues.filter(
          (issue): issue is string => typeof issue === 'string',
        )
      : [],
  }
}

/** Motivos com texto próprio em `admin/product-updates` (`errors.<reason>`). */
export const KNOWN_ERROR_REASONS = [
  'already-published',
  'previously-available',
  'not-done',
  'already-available',
  'not-published',
  'no-pending-changes',
  'published-before',
  'already-done',
  'task-already-set',
  'task-already-linked',
  'tasks-sync-disabled',
  'missing-locales',
  'invalid-content',
  'invalid-image',
  'invalid-image-type',
  'image-too-large',
  'invalid-upload',
  'task-not-found',
  'responsible-required',
  'crmthink-tasks-unavailable',
  'image-storage-unavailable',
] as const

/**
 * Chave de mensagem de um erro: o `reason` quando conhecido; senão pelo status
 * (`401` sessão, `404` não encontrada, `400` pedido inválido); senão a genérica.
 */
export function productUpdateErrorKey(info: ProductUpdateError): string {
  if (
    info.reason &&
    (KNOWN_ERROR_REASONS as readonly string[]).includes(info.reason)
  ) {
    return `errors.${info.reason}`
  }
  if (info.status === 401) return 'errors.unauthorized'
  if (info.status === 404) return 'errors.not-found'
  if (info.status === 400) return 'errors.bad-request'
  return 'errors.generic'
}
