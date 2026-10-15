import { describe, expect, it, vi } from 'vitest'

/**
 * O módulo da fila abre conexão com o Redis ao ser importado (`new Queue`). O teste é
 * sobre as **opções do job**, não sobre a fila, então a conexão e o `Queue` são
 * dublados — o `add` só registra o que recebeu.
 */
const { addMock } = vi.hoisted(() => ({
  addMock: vi.fn((_name: string, data: unknown, opts: { jobId?: string }) =>
    Promise.resolve({ id: opts.jobId ?? 'random-id', data }),
  ),
}))

vi.mock('./redis-connection', () => ({
  bullBaseOptions: { connection: {}, prefix: 'bull' },
}))
vi.mock('bullmq', () => ({
  Queue: class {
    add = addMock
  },
}))
vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// `vi.mock` é içado acima dos imports, então o import estático já pega os dublês.
import { enqueueThinkzapInboundJob } from './thinkzap-inbound.queue'

const job = {
  source: 'bitrix' as const,
  type: 'ONIMCONNECTORMESSAGEADD',
  body: {},
  traceKey: 'trace-1',
}

describe('enqueueThinkzapInboundJob', () => {
  /**
   * Sem retenção, todo job concluído fica no Redis para sempre e o `jobId`
   * determinístico de uma mensagem antiga bloqueia a nova com o mesmo id.
   */
  it('remove jobs terminados depois de um prazo', async () => {
    addMock.mockClear()

    await enqueueThinkzapInboundJob(job, { jobId: 'bitrix-a.bitrix24.com-1' })

    const [, , opts] = addMock.mock.calls[0]!
    expect(opts).toMatchObject({
      removeOnComplete: { age: 24 * 60 * 60 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
      jobId: 'bitrix-a.bitrix24.com-1',
    })
  })

  it('sem jobId deixa o BullMQ gerar um aleatório', async () => {
    addMock.mockClear()

    await enqueueThinkzapInboundJob(job)

    const [, , opts] = addMock.mock.calls[0]!
    expect(opts).not.toHaveProperty('jobId')
  })
})
