import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { productUpdateSituation } from '../domain/entities/product-update'
import {
  CrmthinkTaskNotFoundError,
  CrmthinkTasksUnavailableError,
  ProductUpdateActionRefusedError,
  TaskAlreadyLinkedError,
} from '../domain/errors/product-update.errors'
import {
  InMemoryCrmthinkTasksGateway,
  buildCrmthinkTask,
} from '../infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
  completeProductUpdateContent,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { LinkCrmthinkTask } from './link-crmthink-task'
import { UnlinkCrmthinkTask } from './unlink-crmthink-task'

const now = new Date('2026-10-22T12:00:00.000Z')
const input = { id: 'pu-1', portalUserId: 'portal-user-2', taskId: 42 }

const soon = (overrides = {}) =>
  buildProductUpdate({
    visibility: 'PUBLISHED',
    content: completeProductUpdateContent(),
    publishedContent: completeProductUpdateContent(),
    ...overrides,
  })

function makeSut(
  updates = [soon()],
  tasks = [buildCrmthinkTask({ id: 42, status: 3 })],
) {
  const repository = new InMemoryProductUpdateRepository(updates)
  const gateway = new InMemoryCrmthinkTasksGateway(tasks)
  return {
    repository,
    gateway,
    useCase: new LinkCrmthinkTask(repository, gateway, () => now),
  }
}

describe('LinkCrmthinkTask', () => {
  it('vincula e grava o cache da tarefa; em andamento mantém pendente', async () => {
    const { useCase } = makeSut()

    const saved = await useCase.execute(input)

    expect(saved).toMatchObject({
      progress: 'PENDING',
      bitrixTaskId: 42,
      bitrixTaskTitle: 'Envio de template com imagem',
      bitrixTaskStatus: 3,
      bitrixTaskGroupId: 2677,
      bitrixTaskSyncedAt: now,
    })
  })

  it('tarefa já concluída: a novidade fica concluída ("Aguardando revisão")', async () => {
    const { useCase } = makeSut(undefined, [
      buildCrmthinkTask({ id: 42, status: 5 }),
    ])

    const saved = await useCase.execute(input)

    expect(saved).toMatchObject({
      progress: 'DONE',
      doneAt: now,
      completedBy: null,
    })
    expect(productUpdateSituation(saved)).toBe('awaiting-review')
  })

  it('tarefa já usada por outra novidade: 409 com a dona, sem chamar o Bitrix', async () => {
    const { useCase, gateway, repository } = makeSut([
      soon(),
      soon({ id: 'pu-2', bitrixTaskId: 42 }),
    ])

    const error: unknown = await useCase.execute(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TaskAlreadyLinkedError)
    expect(error).toMatchObject({ taskId: 42, productUpdateId: 'pu-2' })
    expect(gateway.count()).toBe(0)
    expect(repository.rows.get('pu-1')?.bitrixTaskId).toBeNull()
  })

  it('novidade já com outra tarefa: 409 task-already-set', async () => {
    const { useCase } = makeSut([soon({ bitrixTaskId: 7 })])

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'task-already-set',
    })
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      ProductUpdateActionRefusedError,
    )
  })

  it('tarefa inexistente: CrmthinkTaskNotFoundError e nada gravado', async () => {
    const { useCase, repository } = makeSut(undefined, [])

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      CrmthinkTaskNotFoundError,
    )
    expect(repository.rows.get('pu-1')?.bitrixTaskId).toBeNull()
  })

  it('Bitrix indisponível: nada é vinculado', async () => {
    const { useCase, gateway, repository } = makeSut()
    gateway.failing = true

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
    expect(repository.rows.get('pu-1')?.bitrixTaskId).toBeNull()
  })
})

describe('UnlinkCrmthinkTask', () => {
  it('limpa a tarefa e mantém a situação', async () => {
    const original = soon({
      progress: 'DONE',
      doneAt: now,
      bitrixTaskId: 42,
      bitrixTaskTitle: 'Tarefa',
      bitrixTaskStatus: 5,
      bitrixTaskGroupId: 2677,
      bitrixTaskSyncedAt: now,
    })
    const repository = new InMemoryProductUpdateRepository([original])

    const saved = await new UnlinkCrmthinkTask(repository).execute(input)

    expect(saved).toMatchObject({
      bitrixTaskId: null,
      bitrixTaskTitle: null,
      bitrixTaskStatus: null,
      bitrixTaskGroupId: null,
      bitrixTaskSyncedAt: null,
      progress: 'DONE',
      doneAt: now,
    })
    expect(productUpdateSituation(saved)).toBe('awaiting-review')
  })

  it('sem tarefa: devolve como está', async () => {
    const repository = new InMemoryProductUpdateRepository([soon()])

    const saved = await new UnlinkCrmthinkTask(repository).execute(input)

    expect(saved).toEqual(soon())
  })
})
