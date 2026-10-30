import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import type { Request } from 'express'
import { CompleteProductUpdate } from '../../application/complete-product-update'
import { CreateCrmthinkTaskForUpdate } from '../../application/create-crmthink-task-for-update'
import { DeleteProductUpdate } from '../../application/delete-product-update'
import { GetProductUpdate } from '../../application/get-product-update'
import { LinkCrmthinkTask } from '../../application/link-crmthink-task'
import { ListProductUpdates } from '../../application/list-product-updates'
import { PublishProductUpdate } from '../../application/publish-product-update'
import { SearchCrmthinkTasks } from '../../application/search-crmthink-tasks'
import { UpdateProductUpdateContent } from '../../application/update-product-update-content'
import { UploadProductUpdateImage } from '../../application/upload-product-update-image'
import {
  InMemoryCrmthinkTasksGateway,
  buildCrmthinkTask,
} from '../../infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../../infra/persistence/in-memory-product-update.repository.fake'
import {
  CompleteProductUpdateController,
  CreateCrmthinkTaskForUpdateController,
  DeleteProductUpdateController,
  LinkCrmthinkTaskController,
  ListProductUpdatesController,
  ProductUpdateActionController,
  SearchCrmthinkTasksController,
  UpdateProductUpdateContentController,
  UploadProductUpdateImageController,
} from './product-updates-portal-controllers'

const imageUrl = (key: string | null) =>
  key ? `https://img.test/${key}` : null

const request = (overrides: Partial<Request> = {}): Request =>
  ({
    params: { id: 'pu-1' },
    query: {},
    body: {},
    portalUserId: 'portal-user-1',
    ...overrides,
  }) as unknown as Request

const published = () =>
  buildProductUpdate({
    visibility: 'PUBLISHED',
    content: completeProductUpdateContent(),
    publishedContent: completeProductUpdateContent(),
    publishedAt: new Date('2026-10-05T12:00:00.000Z'),
    firstPublishedAt: new Date('2026-10-05T12:00:00.000Z'),
  })

const config = { syncEnabled: true, groupId: 2677 }

describe('controllers das novidades no backoffice', () => {
  it('sem sessão do portal: 401 sem chamar o caso de uso', async () => {
    const execute = vi.fn()
    const controller = new ProductUpdateActionController(execute, imageUrl)

    const response = await controller.perform(
      request({ portalUserId: undefined }),
    )

    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it('detalhe: a view com a URL da imagem', async () => {
    const repository = new InMemoryProductUpdateRepository([
      buildProductUpdate({
        content: completeProductUpdateContent('product-updates/a.png'),
      }),
    ])
    const get = new GetProductUpdate(repository)
    const controller = new ProductUpdateActionController(
      input => get.execute(input.id),
      imageUrl,
    )

    const response = await controller.perform(request())

    expect(response.status).toBe(200)
    expect(response.result).toMatchObject({
      id: 'pu-1',
      situation: 'draft',
      missingLocales: [],
      task: null,
      content: { imageUrl: 'https://img.test/product-updates/a.png' },
    })
  })

  it('novidade inexistente: 404', async () => {
    const get = new GetProductUpdate(new InMemoryProductUpdateRepository())
    const controller = new ProductUpdateActionController(
      input => get.execute(input.id),
      imageUrl,
    )

    const response = await controller.perform(request())

    expect(response).toEqual({
      status: 404,
      result: { error: 'Novidade não encontrada' },
    })
  })

  it('publicar incompleta: 422 missing-locales', async () => {
    const publish = new PublishProductUpdate(
      new InMemoryProductUpdateRepository([buildProductUpdate()]),
    )
    const controller = new ProductUpdateActionController(
      input => publish.execute(input),
      imageUrl,
    )

    const response = await controller.perform(request())

    expect(response.status).toBe(422)
    expect(response.result).toMatchObject({
      reason: 'missing-locales',
      missingLocales: ['pt', 'en', 'es'],
    })
  })

  it('excluir publicada: 409 published-before', async () => {
    const controller = new DeleteProductUpdateController(
      new DeleteProductUpdate(
        new InMemoryProductUpdateRepository([published()]),
      ),
    )

    const response = await controller.perform(request())

    expect(response.status).toBe(409)
    expect(response.result).toMatchObject({ reason: 'published-before' })
  })

  it('excluir rascunho: 200 com o id', async () => {
    const controller = new DeleteProductUpdateController(
      new DeleteProductUpdate(
        new InMemoryProductUpdateRepository([buildProductUpdate()]),
      ),
    )

    expect(await controller.perform(request())).toEqual({
      status: 200,
      result: { id: 'pu-1' },
    })
  })

  it('texto longo demais: 422 invalid-content', async () => {
    const controller = new UpdateProductUpdateContentController(
      new UpdateProductUpdateContent(
        new InMemoryProductUpdateRepository([buildProductUpdate()]),
      ),
      imageUrl,
    )

    const response = await controller.perform(
      request({ body: { texts: { pt: { title: 'x'.repeat(201) } } } }),
    )

    expect(response.status).toBe(422)
    expect(response.result).toMatchObject({ reason: 'invalid-content' })
  })

  it('lista: filtro de situação inválido é 400, válido filtra', async () => {
    const controller = new ListProductUpdatesController(
      new ListProductUpdates(
        new InMemoryProductUpdateRepository([
          buildProductUpdate(),
          { ...published(), id: 'pu-2' },
        ]),
      ),
    )

    expect(
      (await controller.perform(request({ query: { situation: 'x' } }))).status,
    ).toBe(400)
    const response = await controller.perform(
      request({ query: { situation: 'soon' } }),
    )
    expect(response.result).toMatchObject({
      total: 1,
      items: [{ id: 'pu-2', situation: 'soon' }],
    })
  })

  it('imagem sem R2 (storage null): 503 image-storage-unavailable', async () => {
    const controller = new UploadProductUpdateImageController(
      new UploadProductUpdateImage(
        new InMemoryProductUpdateRepository([buildProductUpdate()]),
        null,
      ),
      imageUrl,
    )
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ])

    const response = await controller.perform(
      request({ file: { buffer: png } as Express.Multer.File }),
    )

    expect(response.status).toBe(503)
    expect(response.result).toMatchObject({
      reason: 'image-storage-unavailable',
    })
  })

  it('imagem sem arquivo: 422 invalid-image', async () => {
    const controller = new UploadProductUpdateImageController(
      new UploadProductUpdateImage(
        new InMemoryProductUpdateRepository([buildProductUpdate()]),
        null,
      ),
      imageUrl,
    )

    const response = await controller.perform(request())

    expect(response.status).toBe(422)
    expect(response.result).toMatchObject({ reason: 'invalid-image' })
  })

  describe('tarefas', () => {
    it('vincular tarefa já usada: 409 com a novidade dona', async () => {
      const repository = new InMemoryProductUpdateRepository([
        buildProductUpdate(),
        buildProductUpdate({ id: 'pu-2', bitrixTaskId: 42 }),
      ])
      const controller = new LinkCrmthinkTaskController(
        new LinkCrmthinkTask(
          repository,
          new InMemoryCrmthinkTasksGateway([buildCrmthinkTask()]),
        ),
        imageUrl,
      )

      const response = await controller.perform(
        request({ body: { taskId: 42 } }),
      )

      expect(response.status).toBe(409)
      expect(response.result).toMatchObject({
        reason: 'task-already-linked',
        taskId: 42,
        productUpdateId: 'pu-2',
      })
    })

    it('vincular tarefa inexistente: 422 task-not-found', async () => {
      const controller = new LinkCrmthinkTaskController(
        new LinkCrmthinkTask(
          new InMemoryProductUpdateRepository([buildProductUpdate()]),
          new InMemoryCrmthinkTasksGateway(),
        ),
        imageUrl,
      )

      const response = await controller.perform(
        request({ body: { taskId: '77' } }),
      )

      expect(response.status).toBe(422)
      expect(response.result).toMatchObject({
        reason: 'task-not-found',
        taskId: 77,
      })
    })

    it('vincular sem taskId: 400', async () => {
      const execute = vi.fn()
      const controller = new LinkCrmthinkTaskController({ execute }, imageUrl)

      const response = await controller.perform(
        request({ body: { taskId: 'abc' } }),
      )

      expect(response.status).toBe(400)
      expect(execute).not.toHaveBeenCalled()
    })

    it('criar sem responsável: 422 responsible-required', async () => {
      const controller = new CreateCrmthinkTaskForUpdateController(
        new CreateCrmthinkTaskForUpdate(
          new InMemoryProductUpdateRepository([buildProductUpdate()]),
          new InMemoryCrmthinkTasksGateway(),
          { ...config, backofficeBaseUrl: 'https://front.test' },
        ),
        imageUrl,
      )

      const response = await controller.perform(request({ body: {} }))

      expect(response.status).toBe(422)
      expect(response.result).toMatchObject({ reason: 'responsible-required' })
    })

    it('criar com a sincronização desligada: 409 tasks-sync-disabled', async () => {
      const controller = new CreateCrmthinkTaskForUpdateController(
        new CreateCrmthinkTaskForUpdate(
          new InMemoryProductUpdateRepository([buildProductUpdate()]),
          new InMemoryCrmthinkTasksGateway(),
          {
            syncEnabled: false,
            groupId: 2677,
            backofficeBaseUrl: 'https://front.test',
          },
        ),
        imageUrl,
      )

      const response = await controller.perform(
        request({ body: { responsibleId: 15 } }),
      )

      expect(response.status).toBe(409)
      expect(response.result).toMatchObject({ reason: 'tasks-sync-disabled' })
    })

    it('concluir com tarefa que exige aprovação: update + awaitingApproval', async () => {
      const repository = new InMemoryProductUpdateRepository([
        { ...published(), bitrixTaskId: 42, bitrixTaskStatus: 3 },
      ])
      const gateway = new InMemoryCrmthinkTasksGateway([buildCrmthinkTask()])
      gateway.requiresApproval.add(42)
      const controller = new CompleteProductUpdateController(
        new CompleteProductUpdate(repository, gateway, config),
        imageUrl,
      )

      const response = await controller.perform(request())

      expect(response.status).toBe(200)
      expect(response.result).toMatchObject({
        awaitingApproval: true,
        update: { id: 'pu-1', task: { id: 42, awaitingApproval: true } },
      })
    })

    it('Bitrix fora: 502 crmthink-tasks-unavailable', async () => {
      const gateway = new InMemoryCrmthinkTasksGateway()
      gateway.failing = true
      const controller = new SearchCrmthinkTasksController(
        new SearchCrmthinkTasks(gateway, config),
      )

      const response = await controller.perform(
        request({ query: { q: 'template' } }),
      )

      expect(response.status).toBe(502)
      expect(response.result).toMatchObject({
        reason: 'crmthink-tasks-unavailable',
      })
    })

    it('busca de tarefas: { items }', async () => {
      const controller = new SearchCrmthinkTasksController(
        new SearchCrmthinkTasks(
          new InMemoryCrmthinkTasksGateway([buildCrmthinkTask()]),
          config,
        ),
      )

      const response = await controller.perform(
        request({ query: { q: '#42' } }),
      )

      expect(response.result).toEqual({
        items: [expect.objectContaining({ id: 42, outsideGroup: false })],
      })
    })
  })

  it('erro fora da família é relançado', async () => {
    const controller = new ProductUpdateActionController(
      () => Promise.reject(new Error('boom')),
      imageUrl,
    )

    await expect(controller.perform(request())).rejects.toThrow('boom')
  })
})
