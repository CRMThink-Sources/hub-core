import { afterEach, describe, expect, it, vi } from 'vitest'

/** Só o agendamento e as opções do job importam aqui: conexão e `Queue` são dublados. */
const { addMock } = vi.hoisted(() => ({
  addMock: vi.fn(
    (_name: string, _data: unknown, _opts: Record<string, unknown>) =>
      Promise.resolve(),
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

import {
  enqueueSendNotice,
  SEND_NOTICE_WINDOW_MS,
  sendNoticeSchedule,
} from './thinkzap-send-notices.queue'

const comment = { kind: 'comment', noticeId: 'notice-1' } as const
const alert = { kind: 'alert', noticeId: 'notice-1' } as const

/** Início exato de uma janela de 15 s e também de uma de 120 s. */
const START = 120_000 * 1_000

describe('sendNoticeSchedule', () => {
  it('usa janela de 15 s no comentário e de 2 min no alerta', () => {
    expect(SEND_NOTICE_WINDOW_MS).toEqual({ comment: 15_000, alert: 120_000 })
  })

  it('junta no mesmo job dois eventos da mesma janela', () => {
    const first = sendNoticeSchedule(comment, START + 1_000)
    const second = sendNoticeSchedule(comment, START + 14_999)

    expect(second.jobId).toBe(first.jobId)
    expect(first.jobId).toBe('send-notice-comment-notice-1-8000')
    expect(first.delay).toBe(15_000)
    expect(second.delay).toBe(1_001)
  })

  /** O job roda no fim da janela: o que chega durante a execução não pode colapsar nele. */
  it('abre outro job na janela seguinte', () => {
    const current = sendNoticeSchedule(comment, START + 14_999)
    const next = sendNoticeSchedule(comment, START + 15_000)

    expect(next.jobId).not.toBe(current.jobId)
    expect(next.delay).toBe(16_000)
  })

  /** Relógio adiantado de quem agenda não pode rodar o job antes de a janela fechar. */
  it('roda 1 s depois do fim da janela, mantendo o jobId do início dela', () => {
    const schedule = sendNoticeSchedule(comment, START)

    expect(schedule).toEqual({
      jobId: 'send-notice-comment-notice-1-8000',
      delay: SEND_NOTICE_WINDOW_MS.comment + 1_000,
    })
  })

  it('separa alerta e comentário do mesmo aviso, cada um na sua janela', () => {
    const schedule = sendNoticeSchedule(alert, START + 20_000)

    expect(schedule).toEqual({
      jobId: 'send-notice-alert-notice-1-1000',
      delay: 101_000,
    })
  })

  /** O BullMQ rejeita `:` em `jobId` customizado. */
  it('não usa dois-pontos no jobId', () => {
    expect(sendNoticeSchedule(alert, START).jobId).not.toContain(':')
  })
})

describe('enqueueSendNotice', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('agenda para depois da janela, com 5 tentativas a partir de 5 s', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(START + 5_000)

    await enqueueSendNotice(comment)

    expect(addMock).toHaveBeenCalledWith(expect.any(String), comment, {
      jobId: 'send-notice-comment-notice-1-8000',
      delay: 11_000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    })
  })
})
