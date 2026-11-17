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
  addMock: vi.fn((..._args: unknown[]) => Promise.resolve({ id: 'job-1' })),
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
  enqueueSpaItemStatusSyncJob,
  enqueueSubscriptionBillingSyncJob,
  spaItemCleanupJobId,
  spaItemStatusJobId,
  subscriptionBillingSyncJobId,
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
    expect(subscriptionBillingSyncJobId('27')).not.toContain(':')
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
      // Ids das SPAs 1142 e 1146 são sequências distintas e podem coincidir.
      subscriptionBillingSyncJobId('27'),
    ])

    expect(ids.size).toBe(4)
  })

  it('carregam o id do item, para o job ser rastreável pelo painel', () => {
    expect(spaItemCleanupJobId('27')).toBe('spa-item-cleanup-27')
    expect(spaItemStatusJobId('27')).toBe('spa-item-status-27')
  })
})

describe('opções de enfileiramento dos efeitos da SPA', () => {
  beforeEach(() => addMock.mockClear())

  const cases = [
    {
      name: 'status do item',
      enqueue: () =>
        enqueueSpaItemStatusSyncJob({ itemId: '27', traceKey: 't' }),
      dedupId: 'spa-item-status-27',
    },
    {
      name: 'cobrança da assinatura',
      enqueue: () =>
        enqueueSubscriptionBillingSyncJob({
          subscriptionId: '27',
          traceKey: 't',
        }),
      dedupId: 'spa-subscription-billing-27',
    },
    {
      name: 'limpeza do item',
      enqueue: () => enqueueSpaItemCleanupJob({ itemId: '27', traceKey: 't' }),
      dedupId: 'spa-item-cleanup-27',
    },
  ]

  /**
   * Regressão: com `jobId` fixo e sem remoção, o job concluído ficava retido e o
   * BullMQ descartava todo evento seguinte do mesmo item como duplicado.
   */
  it.each(cases)('$name não usa jobId fixo', async ({ enqueue }) => {
    await enqueue()
    const opts = addMock.mock.calls[0]![2] as Record<string, unknown>
    expect(opts).not.toHaveProperty('jobId')
  })

  it.each(cases)(
    '$name deduplica por item e guarda o evento que chega durante a execução',
    async ({ enqueue, dedupId }) => {
      await enqueue()
      const opts = addMock.mock.calls[0]![2] as Record<string, unknown>
      expect(opts.deduplication).toEqual({
        id: dedupId,
        keepLastIfActive: true,
      })
    },
  )

  it.each(cases)('$name não retém job para sempre', async ({ enqueue }) => {
    await enqueue()
    const opts = addMock.mock.calls[0]![2] as Record<string, unknown>
    expect(opts.removeOnComplete).toBeDefined()
    expect(opts.removeOnFail).toBeDefined()
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
