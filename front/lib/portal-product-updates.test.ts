import { describe, expect, it } from 'vitest'
import {
  availableActions,
  countProductUpdatesBySituation,
  filterProductUpdates,
  missingLocalesOf,
  previewStatus,
  productUpdateErrorKey,
  readProductUpdateError,
  textsChanged,
  type ProductUpdateContent,
  type ProductUpdateListItem,
  type ProductUpdateSituation,
  type ProductUpdateTexts,
  type ProductUpdateView,
} from './portal-product-updates'

const item = (
  id: string,
  situation: ProductUpdateSituation,
): ProductUpdateListItem => ({
  id,
  title: `Novidade ${id}`,
  situation,
  hasPendingChanges: false,
  progress: situation === 'awaiting-review' ? 'DONE' : 'PENDING',
  availableAt: situation === 'available' ? '2026-10-22T12:00:00.000Z' : null,
  publishedAt: null,
  task: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
})

const LIST = [
  item('1', 'draft'),
  item('2', 'awaiting-review'),
  item('3', 'soon'),
  item('4', 'available'),
  item('5', 'awaiting-review'),
]

describe('filterProductUpdates', () => {
  it('"todas" devolve a lista inteira, na ordem da api', () => {
    expect(filterProductUpdates(LIST, 'all').map(i => i.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
  })

  it('recorta pela situação', () => {
    expect(
      filterProductUpdates(LIST, 'awaiting-review').map(i => i.id),
    ).toEqual(['2', '5'])
    expect(filterProductUpdates(LIST, 'draft').map(i => i.id)).toEqual(['1'])
  })

  it('situação sem itens é lista vazia', () => {
    expect(filterProductUpdates([item('1', 'draft')], 'available')).toEqual([])
  })

  it('não muda a lista recebida', () => {
    const copy = [...LIST]
    filterProductUpdates(LIST, 'soon')
    expect(LIST).toEqual(copy)
  })
})

describe('countProductUpdatesBySituation', () => {
  it('conta cada situação e o total', () => {
    expect(countProductUpdatesBySituation(LIST)).toEqual({
      all: 5,
      draft: 1,
      soon: 1,
      'awaiting-review': 2,
      available: 1,
    })
  })

  it('lista vazia: tudo zero', () => {
    expect(countProductUpdatesBySituation([]).all).toBe(0)
  })
})

const content = (
  overrides: Partial<ProductUpdateContent> = {},
): ProductUpdateContent => ({
  pt: { title: 'T', description: 'D' },
  en: { title: 'T', description: 'D' },
  es: { title: 'T', description: 'D' },
  imageKey: null,
  imageUrl: null,
  ...overrides,
})

type ActionCase = Pick<
  ProductUpdateView,
  | 'situation'
  | 'progress'
  | 'availableAt'
  | 'firstPublishedAt'
  | 'hasPendingChanges'
  | 'publishedContent'
>

const view = (overrides: Partial<ActionCase> = {}): ActionCase => ({
  situation: 'draft',
  progress: 'PENDING',
  availableAt: null,
  firstPublishedAt: null,
  hasPendingChanges: false,
  publishedContent: null,
  ...overrides,
})

const published = {
  firstPublishedAt: '2026-10-01T12:00:00.000Z',
  publishedContent: content(),
}

describe('availableActions', () => {
  it('rascunho não concluído: Salvar, Publicar, Marcar como concluída e Excluir — sem Publicar como disponível', () => {
    expect(availableActions(view())).toEqual([
      'save',
      'publish',
      'complete',
      'delete',
    ])
  })

  it('rascunho concluído: pode ir direto para disponível', () => {
    expect(availableActions(view({ progress: 'DONE' }))).toEqual([
      'save',
      'publish',
      'publish-available',
      'reopen',
      'delete',
    ])
  })

  it('em breve: concluir ou despublicar; não exclui nem publica de novo', () => {
    expect(availableActions(view({ situation: 'soon', ...published }))).toEqual(
      ['save', 'complete', 'unpublish'],
    )
  })

  it('aguardando revisão: publicar como disponível, desmarcar ou despublicar', () => {
    expect(
      availableActions(
        view({ situation: 'awaiting-review', progress: 'DONE', ...published }),
      ),
    ).toEqual(['save', 'publish-available', 'reopen', 'unpublish'])
  })

  it('disponível: só salvar e despublicar (não desmarca conclusão)', () => {
    expect(
      availableActions(
        view({
          situation: 'available',
          progress: 'DONE',
          availableAt: '2026-10-22T12:00:00.000Z',
          ...published,
        }),
      ),
    ).toEqual(['save', 'unpublish'])
  })

  it('publicada com alterações pendentes: publicar e descartar alterações', () => {
    expect(
      availableActions(
        view({
          situation: 'available',
          progress: 'DONE',
          availableAt: '2026-10-22T12:00:00.000Z',
          hasPendingChanges: true,
          ...published,
        }),
      ),
    ).toEqual(['save', 'publish-changes', 'discard-changes', 'unpublish'])
  })

  it('rascunho que já foi disponível: volta só como disponível, com a data original, e não exclui', () => {
    expect(
      availableActions(
        view({
          progress: 'DONE',
          availableAt: '2026-10-22T12:00:00.000Z',
          ...published,
        }),
      ),
    ).toEqual(['save', 'publish-available', 'reopen'])
  })

  it('despublicada e pendente: não exclui (já foi publicada)', () => {
    expect(availableActions(view({ ...published }))).toEqual([
      'save',
      'publish',
      'complete',
    ])
  })
})

describe('previewStatus', () => {
  it('"Já disponível" só com data de disponibilidade', () => {
    expect(previewStatus({ availableAt: null })).toBe('soon')
    expect(previewStatus({ availableAt: '2026-10-22T12:00:00.000Z' })).toBe(
      'available',
    )
  })
})

const texts = (
  overrides: Partial<ProductUpdateTexts> = {},
): ProductUpdateTexts => ({
  pt: { title: 'Título', description: 'Descrição' },
  en: { title: 'Title', description: 'Description' },
  es: { title: 'Título', description: 'Descripción' },
  ...overrides,
})

describe('missingLocalesOf / textsChanged', () => {
  it('aponta o idioma sem título ou sem descrição, com trim', () => {
    expect(
      missingLocalesOf(
        texts({
          en: { title: '  ', description: 'x' },
          es: { title: 'x', description: '' },
        }),
      ),
    ).toEqual(['en', 'es'])
    expect(missingLocalesOf(texts())).toEqual([])
  })

  it('espaço a mais não conta como alteração', () => {
    expect(
      textsChanged(
        texts(),
        texts({ pt: { title: ' Título ', description: 'Descrição' } }),
      ),
    ).toBe(false)
    expect(
      textsChanged(
        texts(),
        texts({ en: { title: 'Other', description: 'Description' } }),
      ),
    ).toBe(true)
  })
})

const axiosError = (status: number, data: unknown) => ({
  response: { status, data },
})

describe('readProductUpdateError', () => {
  it('lê a recusa dentro de `result`, com os campos extras', () => {
    expect(
      readProductUpdateError(
        axiosError(422, {
          result: {
            error: 'Idiomas incompletos: es',
            reason: 'missing-locales',
            missingLocales: ['es', 'xx'],
          },
          traceId: 't',
          time: 1,
        }),
      ),
    ).toMatchObject({
      status: 422,
      reason: 'missing-locales',
      missingLocales: ['es'],
    })

    expect(
      readProductUpdateError(
        axiosError(409, {
          result: {
            error: 'x',
            reason: 'task-already-linked',
            taskId: 42,
            productUpdateId: 'pu-9',
          },
        }),
      ),
    ).toMatchObject({ taskId: 42, productUpdateId: 'pu-9' })
  })

  it('lê o erro no topo (multer, 401, 500)', () => {
    expect(
      readProductUpdateError(
        axiosError(422, {
          error: 'A imagem passa de 5 MB',
          reason: 'image-too-large',
        }),
      ),
    ).toMatchObject({ status: 422, reason: 'image-too-large' })
    expect(
      readProductUpdateError(axiosError(401, { error: 'Unauthorized' })),
    ).toMatchObject({ status: 401, reason: undefined })
  })

  it('nunca lança com corpo inesperado', () => {
    expect(readProductUpdateError(new Error('Network'))).toMatchObject({
      status: undefined,
      reason: undefined,
      missingLocales: [],
      issues: [],
    })
    expect(readProductUpdateError(null).status).toBeUndefined()
    expect(readProductUpdateError(axiosError(500, 'oops')).status).toBe(500)
  })
})

describe('productUpdateErrorKey', () => {
  const key = (status: number | undefined, reason?: string) =>
    productUpdateErrorKey({
      status,
      reason,
      missingLocales: [],
      issues: [],
    })

  it('motivo conhecido tem mensagem própria', () => {
    expect(key(409, 'tasks-sync-disabled')).toBe('errors.tasks-sync-disabled')
    expect(key(502, 'crmthink-tasks-unavailable')).toBe(
      'errors.crmthink-tasks-unavailable',
    )
    expect(key(503, 'image-storage-unavailable')).toBe(
      'errors.image-storage-unavailable',
    )
  })

  it('sem motivo conhecido: pelo status, senão genérica', () => {
    expect(key(401)).toBe('errors.unauthorized')
    expect(key(404)).toBe('errors.not-found')
    expect(key(400)).toBe('errors.bad-request')
    expect(key(409, 'something-new')).toBe('errors.generic')
    expect(key(undefined)).toBe('errors.generic')
  })
})
