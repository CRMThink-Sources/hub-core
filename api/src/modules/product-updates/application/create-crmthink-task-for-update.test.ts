import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  CrmthinkTaskResponsibleRequiredError,
  CrmthinkTasksUnavailableError,
  ProductUpdateIncompleteError,
  TasksSyncDisabledError,
} from '../domain/errors/product-update.errors'
import { InMemoryCrmthinkTasksGateway } from '../infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import {
  CreateCrmthinkTaskForUpdate,
  productUpdateBackofficeUrl,
} from './create-crmthink-task-for-update'

const now = new Date('2026-10-22T12:00:00.000Z')
const input = { id: 'pu-1', portalUserId: 'portal-user-2', responsibleId: 15 }
const config = {
  syncEnabled: true,
  groupId: 2677,
  backofficeBaseUrl: 'https://hub.crmthink.com.br/',
}

function makeSut(
  update = buildProductUpdate({ content: completeProductUpdateContent() }),
  overrides: Partial<typeof config> = {},
) {
  const repository = new InMemoryProductUpdateRepository([update])
  const gateway = new InMemoryCrmthinkTasksGateway()
  return {
    repository,
    gateway,
    useCase: new CreateCrmthinkTaskForUpdate(
      repository,
      gateway,
      { ...config, ...overrides },
      () => now,
    ),
  }
}

describe('CreateCrmthinkTaskForUpdate', () => {
  it('cria no grupo configurado com o responsável, texto em pt e link, e vincula', async () => {
    const { useCase, gateway } = makeSut()

    const saved = await useCase.execute(input)

    expect(gateway.calls).toEqual([
      {
        method: 'createTask',
        args: [
          {
            title: 'Envio de template',
            description:
              'Agora com imagem.\n\nNovidade no backoffice: https://hub.crmthink.com.br/admin/novidades/pu-1',
            groupId: 2677,
            responsibleId: 15,
          },
        ],
      },
    ])
    expect(saved).toMatchObject({
      bitrixTaskId: 9000,
      bitrixTaskStatus: 2,
      bitrixTaskGroupId: 2677,
      bitrixTaskSyncedAt: now,
      progress: 'PENDING',
    })
  })

  it('sem responsável: 422 e nenhuma tarefa criada', async () => {
    const { useCase, gateway } = makeSut()

    await expect(
      useCase.execute({ ...input, responsibleId: null }),
    ).rejects.toBeInstanceOf(CrmthinkTaskResponsibleRequiredError)
    await expect(
      useCase.execute({ id: 'pu-1', portalUserId: 'portal-user-2' }),
    ).rejects.toMatchObject({ reason: 'responsible-required' })
    expect(gateway.count()).toBe(0)
  })

  it('sync desligada: 409 tasks-sync-disabled, nada criado nem gravado', async () => {
    const original = buildProductUpdate({
      content: completeProductUpdateContent(),
    })
    const { useCase, gateway, repository } = makeSut(original, {
      syncEnabled: false,
    })

    const error: unknown = await useCase.execute(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TasksSyncDisabledError)
    expect(error).toMatchObject({ reason: 'tasks-sync-disabled' })
    expect(gateway.count()).toBe(0)
    expect(repository.rows.get('pu-1')).toEqual(original)
  })

  it('novidade já com tarefa: 409 task-already-set', async () => {
    const { useCase, gateway } = makeSut(
      buildProductUpdate({
        content: completeProductUpdateContent(),
        bitrixTaskId: 42,
      }),
    )

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'task-already-set',
    })
    expect(gateway.count()).toBe(0)
  })

  it('sem título em português: 422 apontando pt', async () => {
    const { useCase } = makeSut(buildProductUpdate())

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      ProductUpdateIncompleteError,
    )
  })

  it('sem origem do front: descrição sem o link', async () => {
    const { useCase, gateway } = makeSut(undefined, { backofficeBaseUrl: '' })

    await useCase.execute(input)

    expect(gateway.calls[0]?.args[0]).toMatchObject({
      description: 'Agora com imagem.',
    })
  })

  it('Bitrix falha ao criar: nada gravado', async () => {
    const original = buildProductUpdate({
      content: completeProductUpdateContent(),
    })
    const { useCase, gateway, repository } = makeSut(original)
    gateway.failing = true

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
    expect(repository.rows.get('pu-1')).toEqual(original)
  })
})

describe('productUpdateBackofficeUrl', () => {
  it('monta o link da edição', () => {
    expect(productUpdateBackofficeUrl('https://hub.x//', 'abc')).toBe(
      'https://hub.x/admin/novidades/abc',
    )
    expect(productUpdateBackofficeUrl('  ', 'abc')).toBeNull()
  })
})
