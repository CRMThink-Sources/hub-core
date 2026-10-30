import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: { logLevel: 'silent', nodeEnv: 'test', lokiUrl: '' },
}))

import { Request } from 'express'
import { ListPublishedProductUpdates } from '../../application/list-published-product-updates'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../../infra/persistence/in-memory-product-update.repository.fake'
import { ListPublishedProductUpdatesController } from './list-published-product-updates.controller'

const req = (query: Record<string, unknown>) =>
  ({ query, domainId: 'domain-1', appId: 'app-code' }) as unknown as Request

const makeSut = () =>
  new ListPublishedProductUpdatesController(
    new ListPublishedProductUpdates(
      new InMemoryProductUpdateRepository([
        buildProductUpdate({
          visibility: 'PUBLISHED',
          publishedContent: completeProductUpdateContent(),
          publishedAt: new Date('2026-10-05T12:00:00.000Z'),
        }),
      ]),
      () => null,
    ),
  )

describe('ListPublishedProductUpdatesController', () => {
  it('responde `{ items }` no idioma da query', async () => {
    const response = await makeSut().perform(req({ locale: 'es' }))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({
      items: [
        {
          id: 'pu-1',
          title: 'Envío de plantilla',
          description: 'Ahora con imagen.',
          imageUrl: null,
          status: 'soon',
        },
      ],
    })
  })

  it.each([{}, { locale: 'fr' }, { locale: ['es', 'en'] }])(
    'query %j cai em pt',
    async query => {
      const response = await makeSut().perform(req(query))

      expect(response.result).toMatchObject({
        items: [{ title: 'Envio de template' }],
      })
    },
  )
})
