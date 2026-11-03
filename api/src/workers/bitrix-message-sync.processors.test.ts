import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getContextMock, findByBitrixMock, editMock, deleteMock } = vi.hoisted(
  () => ({
    getContextMock: vi.fn(),
    findByBitrixMock: vi.fn(),
    editMock: vi.fn(),
    deleteMock: vi.fn(),
  }),
)

vi.mock('@/config/env', () => ({
  env: {
    appCodes: { thinkzap: 'thinkzap' },
    zApi: { partnerToken: 'pt', clientToken: 'ct' },
  },
}))
vi.mock('@/shared/app-catalog/app-catalog', () => ({
  resolveByMarketplaceCode: () => ({ appCodeId: 'crmthink.thinkzap' }),
}))
vi.mock(
  '@/modules/thinkzap/main/make-bitrix-webhook-context-repository',
  () => ({
    makeBitrixWebhookContextRepository: () => ({ getContext: getContextMock }),
  }),
)
vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({
    PrismaThinkzapMessageRepository: class {
      findByBitrixMessageId = findByBitrixMock
    },
  }),
)
vi.mock('@/modules/thinkzap/infra/clients/z-api.client', () => ({
  ZApiClient: class {
    editMessage = editMock
    deleteMessage = deleteMock
  },
}))
vi.mock('@/shared/infra/logger', () => {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
  return { createWorkerSourceLogger: () => log, apiLogger: log }
})

import { processBitrixMessageUpdate } from './bitrix-message-update.processor'
import { processBitrixMessageDelete } from './bitrix-message-delete.processor'
import type {
  IBX24MessageDeleteEvent,
  IBX24MessageUpdateEvent,
} from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'

const auth = { domain: 'x.bitrix24.com' } as IBX24MessageUpdateEvent['auth']

const updateEvent = (
  messages = [{ im: { message_id: '9' }, message: { text: 'novo' } }],
) =>
  ({
    event: 'U',
    ts: '1',
    auth,
    data: { CONNECTOR: 'c', LINE: '7', MESSAGES: messages },
  }) as IBX24MessageUpdateEvent

const deleteEvent = (messages = [{ im: { message_id: '9' } }]) =>
  ({
    event: 'D',
    ts: '1',
    auth,
    data: { CONNECTOR: 'c', LINE: '7', MESSAGES: messages },
  }) as IBX24MessageDeleteEvent

const zapiContext = {
  connector: { provider: 'ZAPI' },
  instance: { id: 'row-1', instanceId: 'inst', zApiToken: 'tok' },
}

beforeEach(() => {
  vi.clearAllMocks()
  getContextMock.mockResolvedValue(zapiContext)
  findByBitrixMock.mockResolvedValue({
    providerMessageId: 'ZM1',
    chatId: '5511',
  })
  editMock.mockResolvedValue(undefined)
  deleteMock.mockResolvedValue(undefined)
})

describe('processBitrixMessageUpdate', () => {
  it('edita a mensagem na Z-API com o texto novo', async () => {
    await processBitrixMessageUpdate(updateEvent())

    expect(findByBitrixMock).toHaveBeenCalledWith('row-1', '9')
    expect(editMock).toHaveBeenCalledWith('inst', 'tok', '5511', 'ZM1', 'novo')
  })

  it('ignora mensagem sem id do provedor', async () => {
    findByBitrixMock.mockResolvedValue({ providerMessageId: null, chatId: 'c' })

    await processBitrixMessageUpdate(updateEvent())

    expect(editMock).not.toHaveBeenCalled()
  })

  it('descarta evento de linha sem contexto, sem lançar', async () => {
    getContextMock.mockResolvedValue(null)

    await expect(
      processBitrixMessageUpdate(updateEvent()),
    ).resolves.toBeUndefined()
    expect(editMock).not.toHaveBeenCalled()
  })

  it('não chama o provedor em linha oficial', async () => {
    getContextMock.mockResolvedValue({
      ...zapiContext,
      connector: { provider: 'HUBMESSAGE' },
    })

    await processBitrixMessageUpdate(updateEvent())

    expect(findByBitrixMock).not.toHaveBeenCalled()
    expect(editMock).not.toHaveBeenCalled()
  })

  it('falha do provedor não lança', async () => {
    editMock.mockRejectedValue(new Error('boom'))

    await expect(
      processBitrixMessageUpdate(updateEvent()),
    ).resolves.toBeUndefined()
  })

  it('evento sem mensagens é ignorado', async () => {
    await processBitrixMessageUpdate(updateEvent([]))

    expect(getContextMock).not.toHaveBeenCalled()
  })
})

describe('processBitrixMessageDelete', () => {
  it('apaga a mensagem na Z-API', async () => {
    await processBitrixMessageDelete(deleteEvent())

    expect(deleteMock).toHaveBeenCalledWith('inst', 'tok', '5511', 'ZM1')
  })

  it('ignora mensagem sem id do provedor', async () => {
    findByBitrixMock.mockResolvedValue(null)

    await processBitrixMessageDelete(deleteEvent())

    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('descarta evento de linha sem contexto, sem lançar', async () => {
    getContextMock.mockResolvedValue(null)

    await expect(
      processBitrixMessageDelete(deleteEvent()),
    ).resolves.toBeUndefined()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('não chama o provedor em linha oficial', async () => {
    getContextMock.mockResolvedValue({
      ...zapiContext,
      connector: { provider: 'HUBMESSAGE' },
    })

    await processBitrixMessageDelete(deleteEvent())

    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('falha do provedor não lança', async () => {
    deleteMock.mockRejectedValue(new Error('boom'))

    await expect(
      processBitrixMessageDelete(deleteEvent()),
    ).resolves.toBeUndefined()
  })
})
