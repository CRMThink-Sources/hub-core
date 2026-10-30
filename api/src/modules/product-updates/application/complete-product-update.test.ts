import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { productUpdateSituation } from '../domain/entities/product-update'
import {
  CrmthinkTasksUnavailableError,
  ProductUpdateActionRefusedError,
  TasksSyncDisabledError,
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
import { CompleteProductUpdate } from './complete-product-update'

const now = new Date('2026-10-22T12:00:00.000Z')
const input = { id: 'pu-1', portalUserId: 'portal-user-2' }

const soon = (overrides = {}) =>
  buildProductUpdate({
    visibility: 'PUBLISHED',
    content: completeProductUpdateContent(),
    publishedContent: completeProductUpdateContent(),
    ...overrides,
  })

const withTask = () =>
  soon({ bitrixTaskId: 42, bitrixTaskStatus: 3, bitrixTaskGroupId: 2677 })

function makeSut(update = withTask(), syncEnabled = true) {
  const repository = new InMemoryProductUpdateRepository([update])
  const gateway = new InMemoryCrmthinkTasksGateway([
    buildCrmthinkTask({ id: 42, status: 3 }),
  ])
  return {
    repository,
    gateway,
    useCase: new CompleteProductUpdate(
      repository,
      gateway,
      { syncEnabled, groupId: 2677 },
      () => now,
    ),
  }
}

describe('CompleteProductUpdate', () => {
  it('sem tarefa: só a novidade, com quem concluiu', async () => {
    const { useCase, gateway } = makeSut(soon())

    const { update, awaitingApproval } = await useCase.execute(input)

    expect(update).toMatchObject({
      progress: 'DONE',
      doneAt: now,
      completedBy: 'portal-user-2',
    })
    expect(productUpdateSituation(update)).toBe('awaiting-review')
    expect(awaitingApproval).toBe(false)
    expect(gateway.count()).toBe(0)
  })

  it('sem tarefa funciona com a sync desligada', async () => {
    const { useCase } = makeSut(soon(), false)

    const { update } = await useCase.execute(input)

    expect(update.progress).toBe('DONE')
  })

  it('com tarefa, status final 5: conclui no Bitrix e na novidade', async () => {
    const { useCase, gateway } = makeSut()

    const { update, awaitingApproval } = await useCase.execute(input)

    expect(gateway.calls.map(c => c.method)).toEqual([
      'completeTask',
      'getTask',
    ])
    expect(update).toMatchObject({
      progress: 'DONE',
      doneAt: now,
      completedBy: 'portal-user-2',
      bitrixTaskStatus: 5,
      bitrixTaskSyncedAt: now,
    })
    expect(awaitingApproval).toBe(false)
  })

  it('com tarefa, status final 4 (aprovação exigida): pendente e awaitingApproval', async () => {
    const { useCase, gateway } = makeSut()
    gateway.requiresApproval.add(42)

    const { update, awaitingApproval } = await useCase.execute(input)

    expect(update).toMatchObject({
      progress: 'PENDING',
      doneAt: null,
      completedBy: null,
      bitrixTaskStatus: 4,
    })
    expect(productUpdateSituation(update)).toBe('soon')
    expect(awaitingApproval).toBe(true)
  })

  it('Bitrix falha ao concluir: a novidade continua como estava', async () => {
    const original = withTask()
    const { useCase, gateway, repository } = makeSut(original)
    gateway.failing = true

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
    expect(repository.rows.get('pu-1')).toEqual(original)
  })

  it('com tarefa e sync desligada: 409 tasks-sync-disabled, nem tarefa nem novidade mudam', async () => {
    const original = withTask()
    const { useCase, gateway, repository } = makeSut(original, false)

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      TasksSyncDisabledError,
    )
    expect(gateway.count()).toBe(0)
    expect(gateway.tasks.get(42)?.status).toBe(3)
    expect(repository.rows.get('pu-1')).toEqual(original)
  })

  it('já concluída: 409 already-done', async () => {
    const { useCase } = makeSut(soon({ progress: 'DONE', doneAt: now }))

    const error: unknown = await useCase.execute(input).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ProductUpdateActionRefusedError)
    expect(error).toMatchObject({ reason: 'already-done' })
  })
})
