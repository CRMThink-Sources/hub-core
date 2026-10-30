import { describe, expect, it, vi } from 'vitest'

/**
 * O processor importa a fila (pelo nome), e o módulo da fila abre conexão com o Redis
 * na importação; a fábrica padrão traz o Prisma. O teste injeta o caso de uso com os
 * fakes em memória, então conexão, fila e fábrica são dublados.
 */
vi.mock('@/queue/redis-connection', () => ({
  bullBaseOptions: { connection: {}, prefix: 'bull' },
}))
vi.mock('bullmq', () => ({ Queue: class {} }))
vi.mock('@/modules/product-updates/main/make-sync-crmthink-task', () => ({
  makeSyncCrmthinkTask: vi.fn(),
}))
vi.mock('@/shared/infra/logger', () => {
  const logger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
  return { workerLogger: { child: () => logger }, apiLogger: logger }
})

import { SyncCrmthinkTask } from '@/modules/product-updates/application/sync-crmthink-task'
import { CrmthinkTasksUnavailableError } from '@/modules/product-updates/domain/errors/product-update.errors'
import {
  InMemoryCrmthinkTasksGateway,
  buildCrmthinkTask,
} from '@/modules/product-updates/infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import {
  InMemoryProductUpdateRepository,
  buildProductUpdate,
} from '@/modules/product-updates/infra/persistence/in-memory-product-update.repository.fake'
import { processCrmthinkTaskSync } from './crmthink-task-sync.processor'

const now = new Date('2026-10-22T12:00:00.000Z')
const job = { taskId: 42, traceKey: 'crmthink-task-42' }

const linked = (overrides = {}) =>
  buildProductUpdate({
    bitrixTaskId: 42,
    bitrixTaskTitle: 'Título antigo',
    bitrixTaskStatus: 3,
    bitrixTaskGroupId: 2677,
    ...overrides,
  })

function makeSut(
  updates = [linked()],
  tasks = [buildCrmthinkTask({ id: 42, status: 5 })],
) {
  const repository = new InMemoryProductUpdateRepository(updates)
  const gateway = new InMemoryCrmthinkTasksGateway(tasks)
  const sync = new SyncCrmthinkTask(repository, gateway, () => now)
  const run = (syncEnabled = true) =>
    processCrmthinkTaskSync(job, { syncEnabled, makeSync: () => sync })
  return { repository, gateway, run }
}

describe('processCrmthinkTaskSync', () => {
  it('tarefa concluída (5) conclui a novidade e atualiza o cache', async () => {
    const { repository, gateway, run } = makeSut()

    await run()

    expect(gateway.count('getTask')).toBe(1)
    expect(repository.rows.get('pu-1')).toMatchObject({
      progress: 'DONE',
      doneAt: now,
      completedBy: null,
      bitrixTaskStatus: 5,
      bitrixTaskTitle: 'Envio de template com imagem',
      bitrixTaskSyncedAt: now,
    })
  })

  it('tarefa reaberta volta a novidade concluída para pendente', async () => {
    const { repository, run } = makeSut(
      [linked({ progress: 'DONE', doneAt: now, bitrixTaskStatus: 5 })],
      [buildCrmthinkTask({ id: 42, status: 2 })],
    )

    await run()

    expect(repository.rows.get('pu-1')).toMatchObject({
      progress: 'PENDING',
      doneAt: null,
      bitrixTaskStatus: 2,
    })
  })

  it('novidade disponível mantém a conclusão e só atualiza o cache', async () => {
    const availableAt = new Date('2026-10-20T00:00:00.000Z')
    const { repository, run } = makeSut(
      [linked({ progress: 'DONE', doneAt: availableAt, availableAt })],
      [buildCrmthinkTask({ id: 42, status: 2 })],
    )

    await run()

    expect(repository.rows.get('pu-1')).toMatchObject({
      progress: 'DONE',
      doneAt: availableAt,
      availableAt,
      bitrixTaskStatus: 2,
    })
  })

  it('tarefa que não existe mais desvincula e mantém a situação', async () => {
    const { repository, run } = makeSut(
      [linked({ progress: 'DONE', doneAt: now, visibility: 'PUBLISHED' })],
      [],
    )

    await run()

    expect(repository.rows.get('pu-1')).toMatchObject({
      progress: 'DONE',
      visibility: 'PUBLISHED',
      bitrixTaskId: null,
      bitrixTaskTitle: null,
      bitrixTaskStatus: null,
      bitrixTaskSyncedAt: null,
    })
  })

  it('desvinculada depois do evento: termina sem chamar o Bitrix', async () => {
    const { repository, gateway, run } = makeSut([buildProductUpdate()])

    await run()

    expect(gateway.count()).toBe(0)
    expect(repository.rows.get('pu-1')?.updatedAt).toEqual(
      buildProductUpdate().updatedAt,
    )
  })

  it('falha do Bitrix propaga, para o BullMQ tentar de novo', async () => {
    const { gateway, run } = makeSut()
    gateway.failing = true

    await expect(run()).rejects.toBeInstanceOf(CrmthinkTasksUnavailableError)
  })

  it('sincronização desligada descarta o job sem tocar em nada', async () => {
    const { repository, gateway, run } = makeSut()

    await run(false)

    expect(gateway.count()).toBe(0)
    expect(repository.rows.get('pu-1')?.progress).toBe('PENDING')
  })
})
