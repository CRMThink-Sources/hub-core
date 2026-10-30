import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O módulo da fila abre conexão com o Redis ao ser importado (`new Queue`). O teste é
 * sobre as opções do `add`, então conexão e fila são dubladas.
 */
vi.mock('./redis-connection', () => ({
  bullBaseOptions: { connection: {}, prefix: 'bull' },
}))

const { addMock } = vi.hoisted(() => ({
  addMock: vi.fn(() => Promise.resolve({ id: 'task-42' })),
}))
vi.mock('bullmq', () => ({
  Queue: class {
    add = addMock
  },
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  CRMTHINK_TASK_SYNC_DELAY_MS,
  CRMTHINK_TASK_SYNC_JOB,
  crmthinkTaskSyncJobId,
  enqueueCrmthinkTaskSyncJob,
} from './crmthink-task-sync.queue'

describe('fila crmthink-task-sync', () => {
  beforeEach(() => addMock.mockClear())

  it('id por tarefa, sem dois-pontos (o BullMQ recusa)', () => {
    expect(crmthinkTaskSyncJobId(42)).toBe('task-42')
    expect(crmthinkTaskSyncJobId(42)).not.toContain(':')
    expect(crmthinkTaskSyncJobId(42)).not.toBe(crmthinkTaskSyncJobId(43))
  })

  /**
   * Rajada de `ONTASKUPDATE` da mesma tarefa: mesmo `jobId` em todos os `add`, e é o
   * BullMQ que colapsa — enquanto o job espera o atraso.
   */
  it('a rajada da mesma tarefa vai com o mesmo jobId e com atraso', async () => {
    await enqueueCrmthinkTaskSyncJob({ taskId: 42, traceKey: 't1' })
    await enqueueCrmthinkTaskSyncJob({ taskId: 42, traceKey: 't2' })

    expect(addMock).toHaveBeenCalledTimes(2)
    for (const call of addMock.mock.calls as unknown as unknown[][]) {
      expect(call[0]).toBe(CRMTHINK_TASK_SYNC_JOB)
      expect(call[2]).toMatchObject({
        jobId: 'task-42',
        delay: CRMTHINK_TASK_SYNC_DELAY_MS,
      })
    }
    expect(CRMTHINK_TASK_SYNC_DELAY_MS).toBe(5000)
  })

  /**
   * Sem isto, o job concluído ficaria retido com o mesmo id e todo evento posterior
   * da tarefa (reabrir depois de concluir) seria colapsado nele e descartado.
   */
  it('remove o job concluído, para o próximo evento da tarefa não ser colapsado', async () => {
    await enqueueCrmthinkTaskSyncJob({ taskId: 42, traceKey: 't1' })

    expect((addMock.mock.calls as unknown as unknown[][])[0]![2]).toMatchObject(
      { removeOnComplete: true, attempts: 3 },
    )
  })
})
