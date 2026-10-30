import { describe, expect, it } from 'vitest'
import { buildProductUpdate } from '../infra/persistence/in-memory-product-update.repository.fake'
import {
  CrmthinkTaskSnapshot,
  applyTaskStatus,
  isAwaitingTaskApproval,
} from './apply-task-status'
import type { ProductUpdate } from './entities/product-update'

const now = new Date('2026-10-29T12:00:00.000Z')
const earlier = new Date('2026-10-20T12:00:00.000Z')

const task = (status: number): CrmthinkTaskSnapshot => ({
  id: 901,
  title: 'Envio de template com imagem',
  status,
  groupId: 2677,
})

const cacheFor = (status: number) => ({
  bitrixTaskId: 901,
  bitrixTaskTitle: 'Envio de template com imagem',
  bitrixTaskStatus: status,
  bitrixTaskGroupId: 2677,
  bitrixTaskSyncedAt: now,
})

const apply = (update: ProductUpdate, status: number) => ({
  ...update,
  ...applyTaskStatus(update, task(status), { now }),
})

describe('applyTaskStatus', () => {
  it('status 5 conclui a novidade pendente', () => {
    const patch = applyTaskStatus(buildProductUpdate(), task(5), { now })

    expect(patch).toEqual({
      progress: 'DONE',
      doneAt: now,
      completedBy: null,
      ...cacheFor(5),
    })
  })

  it('status 5 vindo do backoffice registra quem concluiu', () => {
    const patch = applyTaskStatus(buildProductUpdate(), task(5), {
      now,
      completedBy: 'portal-user-2',
    })

    expect(patch.completedBy).toBe('portal-user-2')
  })

  it('status 5 numa concluída mantém a data e o autor da conclusão', () => {
    const done = buildProductUpdate({
      progress: 'DONE',
      doneAt: earlier,
      completedBy: 'portal-user-1',
    })

    expect(applyTaskStatus(done, task(5), { now })).toMatchObject({
      progress: 'DONE',
      doneAt: earlier,
      completedBy: 'portal-user-1',
    })
  })

  it('status 4 (aguardando controle) só atualiza o cache', () => {
    const pending = buildProductUpdate()
    expect(applyTaskStatus(pending, task(4), { now })).toEqual({
      progress: 'PENDING',
      doneAt: null,
      completedBy: null,
      ...cacheFor(4),
    })

    const done = buildProductUpdate({ progress: 'DONE', doneAt: earlier })
    expect(applyTaskStatus(done, task(4), { now })).toMatchObject({
      progress: 'DONE',
      doneAt: earlier,
    })
  })

  it.each([2, 3])(
    'status %i com availableAt nulo volta para PENDING',
    status => {
      const done = buildProductUpdate({
        visibility: 'PUBLISHED',
        progress: 'DONE',
        doneAt: earlier,
        completedBy: 'portal-user-1',
      })

      expect(applyTaskStatus(done, task(status), { now })).toEqual({
        progress: 'PENDING',
        doneAt: null,
        completedBy: null,
        ...cacheFor(status),
      })
    },
  )

  it.each([2, 3, 4, 5, 6])(
    'status %i com availableAt preenchido mantém a conclusão',
    status => {
      const available = buildProductUpdate({
        visibility: 'PUBLISHED',
        progress: 'DONE',
        doneAt: earlier,
        availableAt: earlier,
      })

      expect(applyTaskStatus(available, task(status), { now })).toEqual({
        progress: 'DONE',
        doneAt: earlier,
        completedBy: null,
        ...cacheFor(status),
      })
    },
  )

  it.each([2, 4, 5])('é idempotente com status %i', status => {
    const once = apply(buildProductUpdate(), status)
    const twice = apply(once, status)

    expect(twice).toEqual(once)
  })

  it('nunca muda a visibilidade (concluir não publica)', () => {
    const patch = applyTaskStatus(buildProductUpdate(), task(5), { now })
    expect(patch).not.toHaveProperty('visibility')
    expect(patch).not.toHaveProperty('availableAt')
  })
})

describe('isAwaitingTaskApproval', () => {
  it('pendente com tarefa em aguardando controle', () => {
    expect(isAwaitingTaskApproval(apply(buildProductUpdate(), 4))).toBe(true)
  })

  it('concluída, outro status ou sem tarefa: não', () => {
    expect(
      isAwaitingTaskApproval(
        apply(buildProductUpdate({ progress: 'DONE' }), 4),
      ),
    ).toBe(false)
    expect(isAwaitingTaskApproval(apply(buildProductUpdate(), 3))).toBe(false)
    expect(isAwaitingTaskApproval(buildProductUpdate())).toBe(false)
  })
})
