import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getInstanceByInstanceIdMock,
  findByProviderMessageIdMock,
  createMock,
  updateChatIdMock,
  getDomainByIdMock,
  sendToOpenChannelMock,
  findLineItemByInstanceIdMock,
} = vi.hoisted(() => ({
  getInstanceByInstanceIdMock: vi.fn(),
  findByProviderMessageIdMock: vi.fn(),
  createMock: vi.fn(),
  updateChatIdMock: vi.fn(),
  getDomainByIdMock: vi.fn(),
  sendToOpenChannelMock: vi.fn(),
  findLineItemByInstanceIdMock: vi.fn(),
}))

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'hubthink_thinkzap' } },
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository',
  () => ({
    PrismaInstanceRepository: class {
      getInstanceByInstanceId = getInstanceByInstanceIdMock
    },
  }),
)

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({
    PrismaThinkzapMessageRepository: class {
      findByProviderMessageId = findByProviderMessageIdMock
      create = createMock
      updateChatId = updateChatIdMock
    },
  }),
)

vi.mock('../../persistence/repositories/prisma-domain.repository', () => ({
  PrismaDomainRepository: class {
    getDomainById = getDomainByIdMock
  },
}))

vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByDomainAndAppCoode: vi
    .fn()
    .mockResolvedValue({ sendToOpenChannel: sendToOpenChannelMock }),
}))

vi.mock('@/shared/app-catalog/app-catalog', () => ({
  thinkzapAppCodeId: () => 'crmthink.thinkzap',
}))

vi.mock('@/modules/application/main/make-get-aplication-context', () => ({
  makeGetAplicationContext: () => ({ execute: vi.fn() }),
}))

vi.mock(
  '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id',
  () => ({ findLineItemByInstanceId: findLineItemByInstanceIdMock }),
)

import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
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

/**
 * O caso do relato: `Instance.vinculatedChannel` **nulo** — o campo que o guard
 * antigo usava para decidir — e o canal presente no item da SPA.
 */
const instanceWithoutChannel = {
  id: 'inst-db-1',
  instanceId: 'Z-1',
  domainId: 'domain-1',
  vinculatedChannel: null,
}

const widgetMessage = (overrides: Record<string, unknown> = {}) => ({
  id: 'row-1',
  instanceId: 'inst-db-1',
  source: 'BITRIX',
  providerMessageId: 'msg-1',
  type: 'TEXT',
  text: 'Olá',
  chatId: null,
  ...overrides,
})

const lineWithChannel = {
  item: {
    id: 'item-1',
    vinculatedChannel: '10',
    settings: { ...DEFAULT_CONNECTOR_SETTINGS, widgetOpenChannelEnabled: true },
  },
  settings: { ...DEFAULT_CONNECTOR_SETTINGS, widgetOpenChannelEnabled: true },
  entitlement: 'active',
}

describe('StatusCallbackHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getInstanceByInstanceIdMock.mockResolvedValue(instanceWithoutChannel)
    findByProviderMessageIdMock.mockResolvedValue(widgetMessage())
    getDomainByIdMock.mockResolvedValue({
      id: 'domain-1',
      name: 'acme.bitrix24.com.br',
    })
    findLineItemByInstanceIdMock.mockResolvedValue(lineWithChannel)
    sendToOpenChannelMock.mockResolvedValue({
      chatId: '4242',
      bitrixMessageId: '99',
    })
    updateChatIdMock.mockResolvedValue(undefined)
  })

  const handle = (overrides: Record<string, unknown> = {}) =>
    new StatusCallbackHandler().handle(event(overrides))

  /**
   * A correção da causa raiz. Antes o handler retornava em
   * `if (!instance?.vinculatedChannel) return`, e a conversa nunca abria para linha
   * cuja row de `Instance` nasceu antes do vínculo — o caso comum.
   */
  it('abre a conversa mesmo com Instance.vinculatedChannel nulo, decidindo pelo item', async () => {
    await handle()

    expect(sendToOpenChannelMock).toHaveBeenCalledWith(
      '10',
      'hubthink_thinkzap',
      '5511999999999',
      'Olá',
    )
  })

  it('persiste o chatId devolvido pelo Bitrix', async () => {
    await handle()

    expect(updateChatIdMock).toHaveBeenCalledWith('inst-db-1', 'msg-1', '4242')
  })

  /**
   * O write que apagava o corpo da mensagem: `messageRepo.create` sem `text`, sobre
   * um upsert chaveado por `(instance_id, provider_message_id)`.
   */
  it('nunca regrava a mensagem — o texto persistido fica intacto', async () => {
    await handle()

    expect(createMock).not.toHaveBeenCalled()
  })

  it('não faz nada quando a mensagem já tem chatId', async () => {
    findByProviderMessageIdMock.mockResolvedValue(
      widgetMessage({ chatId: '4242' }),
    )

    await handle()

    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('ignora status diferente de SENT', async () => {
    await handle({ status: 'READ' })

    expect(getInstanceByInstanceIdMock).not.toHaveBeenCalled()
  })

  it('ignora evento sem id de mensagem', async () => {
    await handle({ ids: [] })

    expect(getInstanceByInstanceIdMock).not.toHaveBeenCalled()
  })

  /** Corrida read-your-write: a conversa já foi aberta pelo caminho do envio. */
  it('encerra sem erro quando a mensagem ainda não foi persistida', async () => {
    findByProviderMessageIdMock.mockResolvedValue(null)

    await expect(handle()).resolves.toBeUndefined()
    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  it('ignora mensagem que não saiu do widget', async () => {
    findByProviderMessageIdMock.mockResolvedValue(
      widgetMessage({ source: 'ZAPI' }),
    )

    await handle()

    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  it('não posta nada quando o item não é encontrado', async () => {
    findLineItemByInstanceIdMock.mockResolvedValue(null)

    await handle()

    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  it('respeita o toggle desligado no item', async () => {
    findLineItemByInstanceIdMock.mockResolvedValue({
      ...lineWithChannel,
      item: {
        ...lineWithChannel.item,
        settings: {
          ...DEFAULT_CONNECTOR_SETTINGS,
          widgetOpenChannelEnabled: false,
        },
      },
    })

    await handle()

    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  /**
   * Mensagem só de anexo não tem `text` persistido. O caminho antigo passava
   * `message.text as string` e o Bitrix recebia o literal `null`.
   */
  it('usa descritivo do tipo quando a mensagem não tem texto', async () => {
    findByProviderMessageIdMock.mockResolvedValue(
      widgetMessage({ text: null, type: 'IMAGE' }),
    )

    await handle()

    expect(sendToOpenChannelMock).toHaveBeenCalledWith(
      '10',
      'hubthink_thinkzap',
      '5511999999999',
      '[Imagem enviada]',
    )
  })

  it('não posta quando não há texto nem tipo descritível', async () => {
    findByProviderMessageIdMock.mockResolvedValue(
      widgetMessage({ text: null, type: 'TEXT' }),
    )

    await handle()

    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  it('erro do Bitrix não derruba o processamento do webhook', async () => {
    sendToOpenChannelMock.mockRejectedValue(new Error('Bitrix error: 400'))

    await expect(handle()).resolves.toBeUndefined()
  })

  it('portal não encontrado encerra sem tocar o Bitrix', async () => {
    getDomainByIdMock.mockResolvedValue(null)

    await handle()

    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })
})
