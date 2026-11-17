import { describe, expect, it, vi } from 'vitest'

/**
 * O módulo da fila abre conexão com o Redis ao ser importado (`new Queue`). O teste é
 * sobre a **regra do id**, não sobre a fila, então a conexão é dublada — sem isso o
 * import pendura o processo tentando alcançar um Redis que não existe no CI.
 */
vi.mock('./redis-connection', () => ({
  bullBaseOptions: { connection: {}, prefix: 'bull' },
}))
const { addMock } = vi.hoisted(() => ({
  addMock: vi.fn((..._args: unknown[]) => Promise.resolve({ id: 'job-1' })),
}))
vi.mock('bullmq', () => ({
  Queue: class {
    add = addMock
  },
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// `vi.mock` é içado acima dos imports, então o import estático já pega os dublês.
import {
  enqueueSpaItemProvisioningJob,
  spaItemProvisioningJobId,
} from './spa-item-provisioning.queue'

describe('enqueueSpaItemProvisioningJob', () => {
  /**
   * Regressão: `jobId` fixo retinha o job e bloqueava o id para sempre. A reentrega
   * em paralelo também não pode rodar junto — criaria dois recursos no provider.
   */
  it('deduplica por item sem jobId fixo, sem execução paralela e sem reter para sempre', async () => {
    await enqueueSpaItemProvisioningJob({ itemId: '27', traceKey: 't' })

    const opts = addMock.mock.calls[0]![2] as Record<string, unknown>
    expect(opts).not.toHaveProperty('jobId')
    expect(opts.deduplication).toEqual({
      id: 'spa-item-provision-27',
      keepLastIfActive: true,
    })
    expect(opts.removeOnComplete).toBeDefined()
    expect(opts.removeOnFail).toBeDefined()
  })
})

describe('spaItemProvisioningJobId', () => {
  /**
   * O BullMQ recusa id custom com dois-pontos — `Custom Id cannot contain :` —, porque
   * é o separador das chaves dele no Redis. A validação só acontece dentro de `add`, ou
   * seja: em produção, no primeiro item criado à mão. Este teste é o que traz a falha
   * para cá.
   */
  it('não usa dois-pontos, que o BullMQ recusa em id custom', () => {
    expect(spaItemProvisioningJobId('27')).not.toContain(':')
  })

  it('é determinístico por item — é o que colapsa reentrega do Bitrix', () => {
    expect(spaItemProvisioningJobId('27')).toBe(spaItemProvisioningJobId('27'))
    expect(spaItemProvisioningJobId('27')).not.toBe(
      spaItemProvisioningJobId('28'),
    )
  })

  it('carrega o id do item, para o job ser rastreável pelo painel', () => {
    expect(spaItemProvisioningJobId('27')).toBe('spa-item-provision-27')
  })
})
