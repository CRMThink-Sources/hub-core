import { describe, expect, it } from 'vitest'
import { ProductUpdateNotFoundError } from '../domain/errors/product-update.errors'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { GetProductUpdate } from './get-product-update'
import { ListProductUpdates } from './list-product-updates'

const at = (day: number) =>
  new Date(`2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`)

function seed() {
  const edited = completeProductUpdateContent()
  edited.en.title = 'Fixed'

  return new InMemoryProductUpdateRepository([
    buildProductUpdate({ id: 'draft', createdAt: at(1) }),
    buildProductUpdate({
      id: 'soon',
      visibility: 'PUBLISHED',
      content: completeProductUpdateContent(),
      publishedContent: completeProductUpdateContent(),
      createdAt: at(2),
    }),
    buildProductUpdate({
      id: 'review',
      visibility: 'PUBLISHED',
      progress: 'DONE',
      bitrixTaskId: 901,
      bitrixTaskTitle: 'Tarefa',
      bitrixTaskStatus: 5,
      bitrixTaskGroupId: 2677,
      createdAt: at(3),
    }),
    buildProductUpdate({
      id: 'available',
      visibility: 'PUBLISHED',
      progress: 'DONE',
      availableAt: at(22),
      content: edited,
      publishedContent: completeProductUpdateContent(),
      bitrixTaskId: 902,
      bitrixTaskStatus: 4,
      createdAt: at(4),
    }),
  ])
}

describe('ListProductUpdates', () => {
  it('traz situação, pendências, tarefa e data, mais recentes primeiro', async () => {
    const { items, total } = await new ListProductUpdates(seed()).execute()

    expect(total).toBe(4)
    expect(items.map(i => [i.id, i.situation])).toEqual([
      ['available', 'available'],
      ['review', 'awaiting-review'],
      ['soon', 'soon'],
      ['draft', 'draft'],
    ])

    const available = items[0]
    expect(available).toMatchObject({
      title: 'Envio de template',
      hasPendingChanges: true,
      availableAt: at(22),
      task: { id: 902, status: 4, awaitingApproval: false },
    })
    expect(items[1]?.task).toMatchObject({
      id: 901,
      title: 'Tarefa',
      groupId: 2677,
      status: 5,
    })
    expect(items[2]?.hasPendingChanges).toBe(false)
    expect(items[3]?.task).toBeNull()
  })

  it('filtra por situação', async () => {
    const { items, total } = await new ListProductUpdates(seed()).execute({
      situation: 'awaiting-review',
    })

    expect(total).toBe(1)
    expect(items[0]?.id).toBe('review')
  })
})

describe('GetProductUpdate', () => {
  it('devolve a novidade', async () => {
    expect((await new GetProductUpdate(seed()).execute('soon')).id).toBe('soon')
  })

  it('404 sem a novidade', async () => {
    await expect(
      new GetProductUpdate(seed()).execute('x'),
    ).rejects.toBeInstanceOf(ProductUpdateNotFoundError)
  })
})
