import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { productUpdateSituation } from '../domain/entities/product-update'
import {
  CrmthinkTasksUnavailableError,
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
import { ReopenProductUpdate } from './reopen-product-update'

const oct20 = new Date('2026-10-20T12:00:00.000Z')
const now = new Date('2026-10-22T12:00:00.000Z')
const input = { id: 'pu-1', portalUserId: 'portal-user-2' }

/** Publicada e concluída: "Aguardando revisão". */
const awaitingReview = (overrides = {}) =>
  buildProductUpdate({
    visibility: 'PUBLISHED',
    progress: 'DONE',
    doneAt: oct20,
    completedBy: 'portal-user-1',
    content: completeProductUpdateContent(),
    publishedContent: completeProductUpdateContent(),
    ...overrides,
  })

const withTask = () =>
  awaitingReview({
    bitrixTaskId: 42,
    bitrixTaskStatus: 5,
    bitrixTaskGroupId: 2677,
  })

function makeSut(update = withTask(), syncEnabled = true) {
  const repository = new InMemoryProductUpdateRepository([update])
  const gateway = new InMemoryCrmthinkTasksGateway([
    buildCrmthinkTask({ id: 42, status: 5 }),
  ])
  return {
    repository,
    gateway,
    useCase: new ReopenProductUpdate(
      repository,
      gateway,
      { syncEnabled, groupId: 2677 },
      () => now,
    ),
  }
}

describe('ReopenProductUpdate', () => {
  it('sem tarefa: "Aguardando revisão" publicada volta para "Em breve"', async () => {
    const { useCase, gateway } = makeSut(awaitingReview())

    const saved = await useCase.execute(input)

    expect(saved).toMatchObject({
      progress: 'PENDING',
      doneAt: null,
      completedBy: null,
    })
    expect(productUpdateSituation(saved)).toBe('soon')
    expect(gateway.count()).toBe(0)
  })

  it('com tarefa: reabre no Bitrix e atualiza o cache', async () => {
    const { useCase, gateway } = makeSut()

    const saved = await useCase.execute(input)

    expect(gateway.calls.map(c => c.method)).toEqual(['renewTask', 'getTask'])
    expect(saved).toMatchObject({
      progress: 'PENDING',
      bitrixTaskId: 42,
      bitrixTaskStatus: 2,
      bitrixTaskSyncedAt: now,
    })
  })

  it('despublicada que já foi disponível: apaga availableAt e fica rascunho', async () => {
    const { useCase } = makeSut(
      awaitingReview({ visibility: 'DRAFT', availableAt: oct20 }),
    )

    const saved = await useCase.execute(input)

    expect(saved.availableAt).toBeNull()
    expect(productUpdateSituation(saved)).toBe('draft')
  })

  it('disponível: 409 e nada muda', async () => {
    const original = awaitingReview({ availableAt: oct20 })
    const { useCase, repository, gateway } = makeSut(original)

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'already-available',
    })
    expect(repository.rows.get('pu-1')).toEqual(original)
    expect(gateway.count()).toBe(0)
  })

  it('não concluída: 409 not-done', async () => {
    const { useCase } = makeSut(
      awaitingReview({ progress: 'PENDING', doneAt: null }),
    )

    await expect(useCase.execute(input)).rejects.toMatchObject({
      reason: 'not-done',
    })
  })

  it('Bitrix falha ao reabrir: nada gravado', async () => {
    const original = withTask()
    const { useCase, gateway, repository } = makeSut(original)
    gateway.failing = true

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
    expect(repository.rows.get('pu-1')).toEqual(original)
  })

  it('com tarefa e sync desligada: 409 tasks-sync-disabled', async () => {
    const original = withTask()
    const { useCase, gateway, repository } = makeSut(original, false)

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      TasksSyncDisabledError,
    )
    expect(gateway.count()).toBe(0)
    expect(repository.rows.get('pu-1')).toEqual(original)
  })
})
