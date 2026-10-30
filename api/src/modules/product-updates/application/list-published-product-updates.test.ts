import { describe, expect, it } from 'vitest'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { productUpdateImageUrl } from '../domain/ports/product-update-image-storage.port'
import {
  ListPublishedProductUpdates,
  resolveProductUpdateLocale,
} from './list-published-product-updates'

const at = (day: number) =>
  new Date(`2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`)

const imageUrl = (key: string | null) =>
  productUpdateImageUrl('https://cdn.example.com', key)

/** Rascunho, "Em breve", "Aguardando revisão" publicada e "Disponível" com edição pendente. */
function seed() {
  const edited = completeProductUpdateContent('product-updates/nova.png')
  edited.pt.title = 'Título ainda em edição'
  edited.es.title = 'Título en edición'

  return new InMemoryProductUpdateRepository([
    buildProductUpdate({
      id: 'draft',
      content: completeProductUpdateContent(),
    }),
    buildProductUpdate({
      id: 'soon',
      visibility: 'PUBLISHED',
      content: completeProductUpdateContent(),
      publishedContent: completeProductUpdateContent(),
      firstPublishedAt: at(5),
      publishedAt: at(5),
      publishedBy: 'portal-user-1',
    }),
    buildProductUpdate({
      id: 'review',
      visibility: 'PUBLISHED',
      progress: 'DONE',
      doneAt: at(9),
      content: completeProductUpdateContent(),
      publishedContent: completeProductUpdateContent(),
      firstPublishedAt: at(8),
      publishedAt: at(8),
      bitrixTaskId: 901,
      bitrixTaskTitle: 'Tarefa interna',
      bitrixTaskStatus: 5,
    }),
    buildProductUpdate({
      id: 'available',
      visibility: 'PUBLISHED',
      progress: 'DONE',
      availableAt: at(22),
      content: edited,
      publishedContent: completeProductUpdateContent('product-updates/a.png'),
      firstPublishedAt: at(3),
      publishedAt: at(3),
      publishedBy: 'portal-user-2',
      bitrixTaskId: 902,
    }),
  ])
}

describe('ListPublishedProductUpdates', () => {
  it('mistura de situações: dois `soon`, um `available` com data, sem o rascunho', async () => {
    const { items } = await new ListPublishedProductUpdates(
      seed(),
      imageUrl,
    ).execute('pt')

    expect(items).toEqual([
      {
        id: 'available',
        title: 'Envio de template',
        description: 'Agora com imagem.',
        imageUrl: 'https://cdn.example.com/product-updates/a.png',
        status: 'available',
        availableAt: at(22),
      },
      {
        id: 'review',
        title: 'Envio de template',
        description: 'Agora com imagem.',
        imageUrl: null,
        status: 'soon',
      },
      {
        id: 'soon',
        title: 'Envio de template',
        description: 'Agora com imagem.',
        imageUrl: null,
        status: 'soon',
      },
    ])
    expect(items.find(i => i.status === 'soon')).not.toHaveProperty(
      'availableAt',
    )
  })

  it('não expõe tarefa, autoria nem a versão em edição', async () => {
    const { items } = await new ListPublishedProductUpdates(
      seed(),
      imageUrl,
    ).execute('es')

    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(
        item.status === 'available'
          ? ['availableAt', 'description', 'id', 'imageUrl', 'status', 'title']
          : ['description', 'id', 'imageUrl', 'status', 'title'],
      )
    }
    // Alteração pendente (título e imagem novos) não vaza.
    expect(items[0]).toMatchObject({
      title: 'Envío de plantilla',
      imageUrl: 'https://cdn.example.com/product-updates/a.png',
    })
  })

  it('locale=es traz títulos e descrições em espanhol', async () => {
    const { items } = await new ListPublishedProductUpdates(
      seed(),
      imageUrl,
    ).execute('es')

    expect(items.map(i => [i.title, i.description])).toEqual([
      ['Envío de plantilla', 'Ahora con imagen.'],
      ['Envío de plantilla', 'Ahora con imagen.'],
      ['Envío de plantilla', 'Ahora con imagen.'],
    ])
  })

  it.each([undefined, '', 'fr', 'PT', ['es']])(
    'locale %j cai em pt',
    async locale => {
      const { items } = await new ListPublishedProductUpdates(
        seed(),
        imageUrl,
      ).execute(locale)

      expect(items[0]?.title).toBe('Envio de template')
    },
  )

  it('idioma pedido vazio no snapshot cai em pt', async () => {
    const content = completeProductUpdateContent()
    content.en = { title: 'Only title', description: '' }
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        visibility: 'PUBLISHED',
        content,
        publishedContent: content,
        publishedAt: at(1),
      }),
    ])

    const { items } = await new ListPublishedProductUpdates(
      repository,
      imageUrl,
    ).execute('en')

    expect(items[0]).toMatchObject({
      title: 'Envio de template',
      description: 'Agora com imagem.',
    })
  })

  it('ordena `available` por availableAt desc e `soon` por publishedAt desc', async () => {
    const published = completeProductUpdateContent()
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        id: 'soon-old',
        visibility: 'PUBLISHED',
        publishedContent: published,
        publishedAt: at(2),
      }),
      buildProductUpdate({
        id: 'available-old',
        visibility: 'PUBLISHED',
        publishedContent: published,
        publishedAt: at(20),
        availableAt: at(10),
      }),
      buildProductUpdate({
        id: 'soon-new',
        visibility: 'PUBLISHED',
        publishedContent: published,
        publishedAt: at(12),
      }),
      buildProductUpdate({
        id: 'available-new',
        visibility: 'PUBLISHED',
        publishedContent: published,
        publishedAt: at(1),
        availableAt: at(15),
      }),
    ])

    const { items } = await new ListPublishedProductUpdates(
      repository,
      imageUrl,
    ).execute('pt')

    expect(items.map(i => i.id)).toEqual([
      'available-new',
      'available-old',
      'soon-new',
      'soon-old',
    ])
  })

  it('publicada sem snapshot (inconsistente) fica de fora', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({ visibility: 'PUBLISHED', publishedContent: null }),
    ])

    const { items } = await new ListPublishedProductUpdates(
      repository,
      imageUrl,
    ).execute('pt')

    expect(items).toEqual([])
  })
})

describe('resolveProductUpdateLocale', () => {
  it('aceita pt, en e es; o resto vira pt', () => {
    expect(
      ['pt', 'en', 'es', 'de', null].map(resolveProductUpdateLocale),
    ).toEqual(['pt', 'en', 'es', 'pt', 'pt'])
  })
})
