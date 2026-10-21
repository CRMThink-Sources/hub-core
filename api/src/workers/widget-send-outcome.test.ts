import { DelayedError } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'
import {
  DESTINATION_BUSY_RETRY_MS,
  applyWidgetSendOutcome,
} from './widget-send-outcome'

const NOW = 1_000_000

describe('applyWidgetSendOutcome', () => {
  it('done não mexe no job', async () => {
    const job = { moveToDelayed: vi.fn() }
    await applyWidgetSendOutcome(job, 'done', 'tk', NOW)
    expect(job.moveToDelayed).not.toHaveBeenCalled()
  })

  it('destino ocupado adia 2 s com DelayedError (sem gastar tentativa)', async () => {
    const job = { moveToDelayed: vi.fn().mockResolvedValue(undefined) }
    await expect(
      applyWidgetSendOutcome(job, 'reschedule', 'tk', NOW),
    ).rejects.toBeInstanceOf(DelayedError)
    expect(job.moveToDelayed).toHaveBeenCalledWith(
      NOW + DESTINATION_BUSY_RETRY_MS,
      'tk',
    )
  })

  it('Espera não consome tentativas: cadência adia até retryAt com DelayedError', async () => {
    const job = { moveToDelayed: vi.fn().mockResolvedValue(undefined) }
    for (let i = 0; i < 3; i++) {
      await expect(
        applyWidgetSendOutcome(job, { deferUntil: NOW + 300_000 }, 'tk', NOW),
      ).rejects.toBeInstanceOf(DelayedError)
    }
    expect(job.moveToDelayed).toHaveBeenCalledTimes(3)
    expect(job.moveToDelayed).toHaveBeenLastCalledWith(NOW + 300_000, 'tk')
  })

  it('retryAt no passado vira agora', async () => {
    const job = { moveToDelayed: vi.fn().mockResolvedValue(undefined) }
    await expect(
      applyWidgetSendOutcome(job, { deferUntil: NOW - 5 }, 'tk', NOW),
    ).rejects.toBeInstanceOf(DelayedError)
    expect(job.moveToDelayed).toHaveBeenCalledWith(NOW, 'tk')
  })
})
