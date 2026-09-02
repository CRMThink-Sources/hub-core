import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiLogger } = vi.hoisted(() => ({
  apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/shared/infra/logger', () => ({ apiLogger }))

import { reportSmsMessageStatus } from './report-sms-message-status'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reportSmsMessageStatus', () => {
  it('manda CODE, MESSAGE_ID e STATUS', async () => {
    const callMethod = vi.fn().mockResolvedValue({})

    await reportSmsMessageStatus(
      { callMethod },
      { senderCode: 'thinkzap_sms_4821', messageId: 'msg-1', status: 'sent' },
    )

    expect(callMethod).toHaveBeenCalledWith(
      'messageservice.message.status.update',
      {
        CODE: 'thinkzap_sms_4821',
        MESSAGE_ID: 'msg-1',
        STATUS: 'sent',
      },
    )
  })

  it('não lança quando o Bitrix está fora: só registra em log', async () => {
    const callMethod = vi.fn().mockRejectedValue(new Error('ECONNRESET'))

    await expect(
      reportSmsMessageStatus(
        { callMethod },
        {
          senderCode: 'thinkzap_sms_4821',
          messageId: 'msg-1',
          status: 'delivered',
        },
      ),
    ).resolves.toBeUndefined()

    expect(apiLogger.warn).toHaveBeenCalledTimes(1)
  })

  it('não agenda nova tentativa de escrita', async () => {
    const callMethod = vi.fn().mockRejectedValue(new Error('ECONNRESET'))

    await reportSmsMessageStatus(
      { callMethod },
      { senderCode: 'c', messageId: 'm', status: 'failed' },
    )

    expect(callMethod).toHaveBeenCalledTimes(1)
  })
})
