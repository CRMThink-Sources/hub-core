import { describe, expect, it, vi } from 'vitest'

const { getJob, add } = vi.hoisted(() => ({
  getJob: vi.fn(),
  add: vi.fn(),
}))

vi.mock('@/queue/thinkzap-widget-outbound.queue', () => ({
  enqueueThinkzapWidgetOutboundJob: add,
  openChannelJobId: vi.fn(),
  widgetSendJobId: (id: string) => `widget-send-${id}`,
  thinkzapWidgetOutboundQueue: { getJob },
}))

import {
  BullMqWidgetSendQueue,
  needsReschedule,
} from './bullmq-open-channel-conversation.queue'

describe('needsReschedule', () => {
  it.each(['waiting', 'delayed', 'active', 'prioritized', 'waiting-children'])(
    '%s ainda vai rodar',
    state => {
      expect(needsReschedule(state)).toBe(false)
    },
  )

  it.each(['failed', 'completed', 'unknown'])(
    '%s precisa de job novo',
    state => {
      expect(needsReschedule(state)).toBe(true)
    },
  )
})

describe('BullMqWidgetSendQueue.ensureScheduled', () => {
  it('sem job: cria', async () => {
    getJob.mockResolvedValueOnce(undefined)

    expect(await new BullMqWidgetSendQueue().ensureScheduled('ob-1')).toBe(true)
    expect(add).toHaveBeenCalledWith(
      { kind: 'send', outboxId: 'ob-1' },
      { jobId: 'widget-send-ob-1' },
    )
  })

  it('job falho: remove e cria de novo', async () => {
    const remove = vi.fn(() => Promise.resolve())
    getJob.mockResolvedValueOnce({
      getState: () => Promise.resolve('failed'),
      remove,
    })

    expect(await new BullMqWidgetSendQueue().ensureScheduled('ob-1')).toBe(true)
    expect(remove).toHaveBeenCalled()
  })

  it('job atrasado: não mexe', async () => {
    add.mockClear()
    getJob.mockResolvedValueOnce({
      getState: () => Promise.resolve('delayed'),
      remove: vi.fn(),
    })

    expect(await new BullMqWidgetSendQueue().ensureScheduled('ob-1')).toBe(
      false,
    )
    expect(add).not.toHaveBeenCalled()
  })
})
