import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O módulo da fila abre conexão com o Redis ao ser importado (`new Queue`). O teste é
 * sobre a **regra do id**, não sobre a fila, então a conexão é dublada — sem isso o
 * import pendura o processo tentando alcançar um Redis que não existe no CI.
 */
vi.mock('./redis-connection', () => ({
  bullBaseOptions: { connection: {}, prefix: 'bull' },
}))

const { addMock, infoMock } = vi.hoisted(() => ({
  addMock: vi.fn(() => Promise.resolve({ id: 'job-1' })),
  infoMock: vi.fn(),
}))
vi.mock('bullmq', () => ({
  Queue: class {
    add = addMock
  },
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: infoMock, debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// `vi.mock` é içado acima dos imports, então o import estático já pega os dublês.
import {
  enqueueSpaItemCleanupJob,
  spaItemCleanupJobId,
  spaItemStatusJobId,
} from './spa-item-resource-sync.queue'
import { spaItemProvisioningJobId } from './spa-item-provisioning.queue'

describe('ids de job da fila de recurso do item', () => {
  /**
   * O BullMQ recusa id custom com dois-pontos — `Custom Id cannot contain :` —, porque
   * é o separador das chaves dele no Redis. A validação só acontece dentro de `add`, ou
   * seja: em produção, no primeiro evento real. Este teste é o que traz a falha para cá.
   */
  it('não usam dois-pontos, que o BullMQ recusa em id custom', () => {
    expect(spaItemCleanupJobId('27')).not.toContain(':')
    expect(spaItemStatusJobId('27')).not.toContain(':')
  })

  it('são determinísticos por item — é o que colapsa reentrega do Bitrix', () => {
    expect(spaItemCleanupJobId('27')).toBe(spaItemCleanupJobId('27'))
    expect(spaItemCleanupJobId('27')).not.toBe(spaItemCleanupJobId('28'))
    expect(spaItemStatusJobId('27')).toBe(spaItemStatusJobId('27'))
    expect(spaItemStatusJobId('27')).not.toBe(spaItemStatusJobId('28'))
  })

  /**
   * A razão de os dois efeitos morarem na mesma fila com prefixo distinto: um item
   * editado e apagado em sequência precisa dos dois jobs, e id igual faria o BullMQ
   * colapsar o segundo — deixando o recurso órfão ou a cobrança divergente.
   */
  it('não colapsam entre si nem com o job de provisionamento do mesmo item', () => {
    const ids = new Set([
      spaItemCleanupJobId('27'),
      spaItemStatusJobId('27'),
      spaItemProvisioningJobId('27'),
    ])

    expect(ids.size).toBe(3)
  })

  it('carregam o id do item, para o job ser rastreável pelo painel', () => {
    expect(spaItemCleanupJobId('27')).toBe('spa-item-cleanup-27')
    expect(spaItemStatusJobId('27')).toBe('spa-item-status-27')
  })
})

describe('enqueueSpaItemCleanupJob', () => {
  beforeEach(() => {
    addMock.mockClear()
    infoMock.mockClear()
  })

  it('loga deletedBy/deletedAt quando vêm no job (exclusão pela rota)', async () => {
    await enqueueSpaItemCleanupJob({
      itemId: '27',
      traceKey: 'trace-1',
      deletedBy: 'Ana Souza',
      deletedAt: '2026-09-10T12:00:00.000Z',
    })

    expect(infoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: '27',
        deletedBy: 'Ana Souza',
        deletedAt: '2026-09-10T12:00:00.000Z',
      }),
      'Limpeza do recurso de item apagado enfileirada',
    )
  })

  /** Item apagado direto pelo Bitrix não tem "quem excluiu" — o log não deve inventar. */
  it('não loga deletedBy/deletedAt quando ausentes (item apagado pelo Bitrix)', async () => {
    await enqueueSpaItemCleanupJob({ itemId: '27', traceKey: 'trace-1' })

    const loggedFields = infoMock.mock.calls[0]![0] as Record<string, unknown>
    expect(loggedFields).not.toHaveProperty('deletedBy')
    expect(loggedFields).not.toHaveProperty('deletedAt')
  })
})
