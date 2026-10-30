import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import type { ProductUpdate } from '../domain/entities/product-update'
import { CrmthinkTasksUnavailableError } from '../domain/errors/product-update.errors'
import type { CrmthinkTask } from '../domain/ports/crmthink-tasks-gateway.port'
import {
  InMemoryCrmthinkTasksGateway,
  buildCrmthinkTask,
} from '../infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
} from '../infra/persistence/in-memory-product-update.repository.fake'
import { ReconcileCrmthinkTasks } from './reconcile-crmthink-tasks'

const now = new Date('2026-10-22T12:15:00.000Z')

/** `n` novidades pendentes, vinculadas às tarefas 1..n. */
const linkedUpdates = (n: number): ProductUpdate[] =>
  Array.from({ length: n }, (_, i) =>
    buildProductUpdate({ id: `pu-${i + 1}`, bitrixTaskId: i + 1 }),
  )

const completedTasks = (n: number): CrmthinkTask[] =>
  Array.from({ length: n }, (_, i) =>
    buildCrmthinkTask({ id: i + 1, status: 5 }),
  )

function makeSut(updates: ProductUpdate[], tasks: CrmthinkTask[]) {
  const repository = new InMemoryProductUpdateRepository(updates)
  const gateway = new InMemoryCrmthinkTasksGateway(tasks)
  return {
    repository,
    gateway,
    useCase: new ReconcileCrmthinkTasks(repository, gateway, () => now),
  }
}

describe('ReconcileCrmthinkTasks', () => {
  it('aplica a regra de conclusão a cada novidade', async () => {
    const { repository, useCase } = makeSut(
      [
        buildProductUpdate({ id: 'pu-1', bitrixTaskId: 1 }),
        buildProductUpdate({
          id: 'pu-2',
          bitrixTaskId: 2,
          progress: 'DONE',
          doneAt: now,
        }),
      ],
      [
        buildCrmthinkTask({ id: 1, status: 5 }),
        buildCrmthinkTask({ id: 2, status: 3 }),
      ],
    )

    const result = await useCase.execute()

    expect(result).toMatchObject({ total: 2, synced: 2, unlinked: 0 })
    expect(repository.rows.get('pu-1')).toMatchObject({
      progress: 'DONE',
      bitrixTaskStatus: 5,
      bitrixTaskSyncedAt: now,
    })
    expect(repository.rows.get('pu-2')).toMatchObject({
      progress: 'PENDING',
      doneAt: null,
    })
  })

  it('lê em lotes de 50, uma chamada por lote', async () => {
    const { gateway, useCase } = makeSut(
      linkedUpdates(120),
      completedTasks(120),
    )

    await useCase.execute()

    const batches = gateway.calls
      .filter(c => c.method === 'getTasks')
      .map(c => (c.args[0] as number[]).length)
    expect(batches).toEqual([50, 50, 20])
  })

  it('ignora disponíveis e sem tarefa (listReconcilable)', async () => {
    const { gateway, useCase } = makeSut(
      [
        buildProductUpdate({ id: 'pu-1' }),
        buildProductUpdate({
          id: 'pu-2',
          bitrixTaskId: 2,
          availableAt: now,
        }),
      ],
      [],
    )

    const result = await useCase.execute()

    expect(result.total).toBe(0)
    expect(gateway.count()).toBe(0)
  })

  it('tarefa ausente do resultado é desvinculada e mantém a situação', async () => {
    const { repository, useCase } = makeSut(
      [
        buildProductUpdate({
          id: 'pu-1',
          bitrixTaskId: 1,
          bitrixTaskStatus: 3,
          visibility: 'PUBLISHED',
        }),
      ],
      [],
    )

    const result = await useCase.execute()

    expect(result.unlinked).toBe(1)
    expect(repository.rows.get('pu-1')).toMatchObject({
      visibility: 'PUBLISHED',
      progress: 'PENDING',
      bitrixTaskId: null,
      bitrixTaskStatus: null,
    })
  })

  it('lote com erro não impede o próximo', async () => {
    const { repository, gateway, useCase } = makeSut(
      linkedUpdates(60),
      completedTasks(60),
    )
    const original = gateway.getTasks.bind(gateway)
    let call = 0
    vi.spyOn(gateway, 'getTasks').mockImplementation(ids => {
      call += 1
      return call === 1
        ? Promise.reject(new CrmthinkTasksUnavailableError('lote 1 falhou'))
        : original(ids)
    })

    const result = await useCase.execute()

    expect(result).toMatchObject({
      total: 60,
      synced: 10,
      failed: 50,
      failedBatches: 1,
    })
    // O primeiro lote fica como estava; o segundo é reconciliado.
    expect(repository.rows.get('pu-1')?.progress).toBe('PENDING')
    expect(repository.rows.get('pu-1')?.bitrixTaskSyncedAt).toBeNull()
    expect(repository.rows.get('pu-51')?.progress).toBe('DONE')
  })

  it('falha ao gravar uma novidade não leva o resto do lote', async () => {
    const { repository, useCase } = makeSut(linkedUpdates(2), completedTasks(2))
    const original = repository.save.bind(repository)
    vi.spyOn(repository, 'save').mockImplementation(update =>
      update.id === 'pu-1'
        ? Promise.reject(new Error('banco fora'))
        : original(update),
    )

    const result = await useCase.execute()

    expect(result).toMatchObject({ synced: 1, failed: 1 })
    expect(repository.rows.get('pu-2')?.progress).toBe('DONE')
  })

  it('não grava a cópia velha se a novidade foi desvinculada durante a leitura', async () => {
    const { repository, gateway, useCase } = makeSut(
      linkedUpdates(1),
      completedTasks(1),
    )
    const original = gateway.getTasks.bind(gateway)
    vi.spyOn(gateway, 'getTasks').mockImplementation(async ids => {
      const update = repository.rows.get('pu-1')!
      repository.rows.set('pu-1', { ...update, bitrixTaskId: null })
      return original(ids)
    })

    await useCase.execute()

    expect(repository.rows.get('pu-1')).toMatchObject({
      bitrixTaskId: null,
      progress: 'PENDING',
    })
  })
})
