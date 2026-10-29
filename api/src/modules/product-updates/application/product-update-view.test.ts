import { describe, expect, it } from 'vitest'
import {
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { toProductUpdateView } from './product-update-view'

const imageUrl = (key: string | null) => (key ? `https://cdn/${key}` : null)

describe('toProductUpdateView', () => {
  it('soma derivações, URLs das duas versões e a tarefa agrupada', () => {
    const content = completeProductUpdateContent('product-updates/new.png')
    content.es.title = ''
    const view = toProductUpdateView(
      buildProductUpdate({
        visibility: 'PUBLISHED',
        content,
        publishedContent: completeProductUpdateContent(
          'product-updates/old.png',
        ),
        bitrixTaskId: 901,
        bitrixTaskTitle: 'Tarefa',
        bitrixTaskStatus: 4,
        bitrixTaskGroupId: 2677,
      }),
      imageUrl,
    )

    expect(view).toMatchObject({
      situation: 'soon',
      hasPendingChanges: true,
      missingLocales: ['es'],
      task: { id: 901, status: 4, awaitingApproval: true },
    })
    expect(view.content.imageUrl).toBe('https://cdn/product-updates/new.png')
    expect(view.publishedContent?.imageUrl).toBe(
      'https://cdn/product-updates/old.png',
    )
    expect(view).not.toHaveProperty('bitrixTaskId')
  })

  it('sem tarefa nem snapshot', () => {
    const view = toProductUpdateView(buildProductUpdate(), imageUrl)

    expect(view.task).toBeNull()
    expect(view.publishedContent).toBeNull()
    expect(view.content.imageUrl).toBeNull()
  })
})
