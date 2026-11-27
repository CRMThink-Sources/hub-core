import { DelayedError } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { notifySendFailures } from '@/modules/thinkzap/application/notify-send-failures'
import type { refreshSendComment } from '@/modules/thinkzap/application/refresh-send-comment'
import { SendNoticeDeferredError } from '@/modules/thinkzap/domain/errors/send-notice-deferred.error'
import type { SendNoticeJob } from '@/queue/thinkzap-send-notices.queue'
import type { DeferrableSendNoticeJob } from './send-notice-deferral'

/** Só o roteamento do erro importa aqui: casos de uso e dependências são dublados. */
const { refreshMock, notifyMock } = vi.hoisted(() => ({
  refreshMock: vi.fn<typeof refreshSendComment>(),
  notifyMock: vi.fn<typeof notifySendFailures>(),
}))

vi.mock('@/modules/thinkzap/application/refresh-send-comment', () => ({
  refreshSendComment: refreshMock,
}))
vi.mock('@/modules/thinkzap/application/notify-send-failures', () => ({
  notifySendFailures: notifyMock,
}))
vi.mock('@/modules/thinkzap/main/make-send-notice-deps', () => ({
  makeRefreshSendCommentDeps: () => ({}),
  makeNotifySendFailuresDeps: () => ({}),
}))

import { processSendNoticeJob } from './thinkzap-send-notices.processor'

function job(data: SendNoticeJob) {
  return {
    data,
    updateData: vi
      .fn<DeferrableSendNoticeJob['updateData']>()
      .mockResolvedValue(undefined),
    moveToDelayed: vi
      .fn<DeferrableSendNoticeJob['moveToDelayed']>()
      .mockResolvedValue(undefined),
  }
}

describe('processSendNoticeJob', () => {
  beforeEach(() => {
    refreshMock.mockReset().mockResolvedValue(undefined)
    notifyMock.mockReset().mockResolvedValue(undefined)
  })

  it.each([
    ['comment', refreshMock],
    ['alert', notifyMock],
  ] as const)(
    '%s adiado pelo Bitrix volta à fila sem gastar tentativa',
    async (kind, useCase) => {
      const until = Date.now() + 60_000
      useCase.mockRejectedValue(new SendNoticeDeferredError('notice-1', until))
      const target = job({ kind, noticeId: 'notice-1' })

      await expect(processSendNoticeJob(target, 'tk')).rejects.toBeInstanceOf(
        DelayedError,
      )
      expect(target.moveToDelayed).toHaveBeenCalledWith(until, 'tk')
    },
  )

  it('outro erro sobe como está, para o backoff do job', async () => {
    refreshMock.mockRejectedValue(new Error('db fora'))
    const target = job({ kind: 'comment', noticeId: 'notice-1' })

    await expect(processSendNoticeJob(target, 'tk')).rejects.toThrow('db fora')
    expect(target.moveToDelayed).not.toHaveBeenCalled()
  })
})
