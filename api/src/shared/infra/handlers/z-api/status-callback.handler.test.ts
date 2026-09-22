import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureOpenChannelExecuteMock } = vi.hoisted(() => ({
  ensureOpenChannelExecuteMock: vi.fn(),
}))

vi.mock(
  '@/modules/thinkzap/application/ensure-widget-open-channel-conversation',
  () => ({
    EnsureWidgetOpenChannelConversation: class {
      execute = ensureOpenChannelExecuteMock
    },
  }),
)

import { StatusCallbackHandler } from './status-callback.handler'

const event = (overrides: Record<string, unknown> = {}) =>
  ({
    instanceId: 'Z-1',
    status: 'SENT',
    ids: ['msg-1'],
    moment: 0,
    phoneDevice: 0,
    phone: '5511999999999',
    type: 'ReceivedCallback',
    isGroup: false,
    ...overrides,
  }) as never

describe('StatusCallbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('continua registrado para MessageStatusCallback', () => {
    expect(new StatusCallbackHandler().eventType).toBe('MessageStatusCallback')
  })

  /**
   * A regressão desta change: um `SENT` chegando enquanto o job `open-channel` ainda não
   * gravou o `chat_id` abria uma segunda conversa no canal aberto.
   */
  it('não abre conversa no canal aberto ao receber SENT', async () => {
    await expect(
      new StatusCallbackHandler().handle(event()),
    ).resolves.toBeUndefined()

    expect(ensureOpenChannelExecuteMock).not.toHaveBeenCalled()
  })
})
