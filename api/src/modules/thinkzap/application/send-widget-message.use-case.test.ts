import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendToOpenChannelMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@/shared/infra/clients/bitrix.client', () => {
  class BitrixClient {
    sendToOpenChannel = sendToOpenChannelMock
  }
  return { BitrixClient }
})

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'hubthink_thinkzap' } },
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

import { SendWidgetMessageUseCase } from './send-widget-message.use-case'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

const makeConnector = () => ({ id: 'conn-1', instanceId: 'inst-db-1' })

const makeInstance = (vinculatedChannel: string | null = '10') => ({
  id: 'inst-db-1',
  instanceId: 'INST-A',
  vinculatedChannel,
  zApiToken: 'tok',
})

function makeUseCase() {
  const getConnectorRepository = {
    get: vi.fn().mockResolvedValue(makeConnector()),
  }
  const getInstanceRepository = {
    getInstance: vi.fn().mockResolvedValue(makeInstance()),
  }
  const zApiClient = {
    getPhoneData: vi.fn().mockResolvedValue({ phone: '5511911111111' }),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
    sendImage: vi.fn(),
    sendVideo: vi.fn(),
    sendAudio: vi.fn(),
    sendDocument: vi.fn(),
  }
  const sendBitrixNotification = {
    execute: vi.fn().mockResolvedValue(undefined),
  }
  const bitrixClient = new BitrixClient({} as never)

  const useCase = new SendWidgetMessageUseCase(
    getConnectorRepository as never,
    getInstanceRepository as never,
    zApiClient as never,
    sendBitrixNotification as never,
    bitrixClient,
  )

  return {
    useCase,
    getConnectorRepository,
    getInstanceRepository,
    zApiClient,
    sendBitrixNotification,
  }
}

const baseInput = {
  connectorId: 'conn-1',
  destination: '5511999999999',
  message: 'Olá',
  entity: 'deal',
  entityId: '42',
}

describe('SendWidgetMessageUseCase — open channel creation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendToOpenChannelMock.mockResolvedValue(undefined)
  })

  it('calls sendToOpenChannel when vinculatedChannel is set', async () => {
    const { useCase } = makeUseCase()

    await useCase.execute(baseInput)

    expect(sendToOpenChannelMock).toHaveBeenCalledOnce()
    expect(sendToOpenChannelMock).toHaveBeenCalledWith(
      '10',
      'hubthink_thinkzap',
      '5511999999999',
      'Olá',
    )
  })

  it('skips sendToOpenChannel when vinculatedChannel is null', async () => {
    const { useCase, getInstanceRepository } = makeUseCase()
    getInstanceRepository.getInstance.mockResolvedValue(makeInstance(null))

    await useCase.execute(baseInput)

    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  it('uses fallback text when message is empty (attachments only)', async () => {
    const { useCase, zApiClient } = makeUseCase()
    zApiClient.sendImage.mockResolvedValue({ messageId: 'msg-img-1' })

    await useCase.execute({
      ...baseInput,
      message: '',
      attachments: [{ kind: 'image', content: 'data:image/png;base64,aaa' }],
    })

    expect(sendToOpenChannelMock).toHaveBeenCalledWith(
      '10',
      'hubthink_thinkzap',
      '5511999999999',
      '[Arquivo enviado]',
    )
  })

  it('does not throw and continues when sendToOpenChannel fails', async () => {
    const { useCase, sendBitrixNotification } = makeUseCase()
    sendToOpenChannelMock.mockRejectedValue(new Error('Bitrix error'))

    await expect(useCase.execute(baseInput)).resolves.toMatchObject({
      message: 'Message sent successfully',
    })
    expect(sendBitrixNotification.execute).toHaveBeenCalled()
  })
})
