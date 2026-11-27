import { DelayedError } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'
import { SendNoticeDeferredError } from '@/modules/thinkzap/domain/errors/send-notice-deferred.error'
import type { SendNoticeJob } from '@/queue/thinkzap-send-notices.queue'
import {
  deferSendNoticeJob,
  MAX_SEND_NOTICE_DEFERRALS,
  type DeferrableSendNoticeJob,
} from './send-notice-deferral'

const NOW = 1_000_000

function job(data: SendNoticeJob) {
  const moveToDelayed = vi
    .fn<DeferrableSendNoticeJob['moveToDelayed']>()
    .mockResolvedValue(undefined)
  const updateData = vi
    .fn<DeferrableSendNoticeJob['updateData']>()
    .mockResolvedValue(undefined)
  return { data, moveToDelayed, updateData }
}

const deferred = (untilMs: number) =>
  new SendNoticeDeferredError('notice-1', untilMs)

describe('deferSendNoticeJob', () => {
  it('reagenda até o fim da pausa sem gastar tentativa e conta o adiamento', async () => {
    const target = job({ kind: 'comment', noticeId: 'notice-1' })

    await expect(
      deferSendNoticeJob(target, deferred(NOW + 90_000), 'tk', NOW),
    ).rejects.toBeInstanceOf(DelayedError)

    expect(target.updateData).toHaveBeenCalledWith({
      kind: 'comment',
      noticeId: 'notice-1',
      deferrals: 1,
    })
    expect(target.moveToDelayed).toHaveBeenCalledWith(NOW + 90_000, 'tk')
  })

  it('pausa já vencida não agenda no passado', async () => {
    const target = job({ kind: 'alert', noticeId: 'notice-1', deferrals: 2 })

    await expect(
      deferSendNoticeJob(target, deferred(NOW - 1), 'tk', NOW),
    ).rejects.toBeInstanceOf(DelayedError)

    expect(target.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ deferrals: 3 }),
    )
    expect(target.moveToDelayed).toHaveBeenCalledWith(NOW, 'tk')
  })

  it('no teto de adiamentos devolve o erro, que gasta tentativa', async () => {
    const target = job({
      kind: 'comment',
      noticeId: 'notice-1',
      deferrals: MAX_SEND_NOTICE_DEFERRALS,
    })
    const error = deferred(NOW + 90_000)

    await expect(deferSendNoticeJob(target, error, 'tk', NOW)).rejects.toBe(
      error,
    )

    expect(target.moveToDelayed).not.toHaveBeenCalled()
    expect(target.updateData).not.toHaveBeenCalled()
  })
})
