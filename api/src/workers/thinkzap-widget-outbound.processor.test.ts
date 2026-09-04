import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDomainByIdMock,
  getAplicationContextMock,
  makeBitrixClientMock,
  sendToOpenChannelMock,
  findByProviderMessageIdMock,
  updateOpenChannelRefsMock,
  resolveContactMock,
  getCrmContactNameMock,
} = vi.hoisted(() => ({
  getDomainByIdMock: vi.fn(),
  getAplicationContextMock: vi.fn(),
  makeBitrixClientMock: vi.fn(),
  sendToOpenChannelMock: vi.fn(),
  findByProviderMessageIdMock: vi.fn(),
  updateOpenChannelRefsMock: vi.fn(),
  resolveContactMock: vi.fn(),
  getCrmContactNameMock: vi.fn(),
}))

vi.mock('@/config/env', () => ({
  env: {
    bitrix: { connector: { code: 'hubthink_thinkzap' } },
    logLevel: 'silent',
    nodeEnv: 'test',
  },
}))

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createWorkerSourceLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-domain.repository',
  () => ({
    PrismaDomainRepository: class {
      getDomainById = getDomainByIdMock
    },
  }),
)

vi.mock(
  '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository',
  () => ({
    PrismaThinkzapMessageRepository: class {
      findByProviderMessageId = findByProviderMessageIdMock
      updateOpenChannelRefs = updateOpenChannelRefsMock
    },
  }),
)

vi.mock('@/modules/application/main/make-get-aplication-context', () => ({
  makeGetAplicationContext: () => ({ execute: getAplicationContextMock }),
}))

vi.mock('@/shared/main/make-bitrix-client', () => ({
  makeBitrixClientByDomainAndAppCoode: makeBitrixClientMock,
}))

/**
 * A resolução da identidade toca Prisma e a Z-API. Aqui ela é dublada porque o que
 * este arquivo mede é o processor; a cadeia tem arquivo próprio.
 */
vi.mock(
  '@/modules/thinkzap/main/make-resolve-widget-open-channel-contact',
  () => ({
    makeResolveWidgetOpenChannelContact: () => resolveContactMock,
  }),
)

vi.mock('@/modules/thinkzap/application/get-crm-contact-name', () => ({
  makeGetCrmContactName: () => getCrmContactNameMock,
}))

import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { processWidgetOpenChannelJob } from './thinkzap-widget-outbound.processor'

const zapiItem = (
  overrides: Partial<SubscriptionItem> = {},
): SubscriptionItem => ({
  id: 'item-1',
  name: 'Linha comercial',
  subscription: 'sub-1',
  status: 'active',
  settings: { ...DEFAULT_CONNECTOR_SETTINGS, widgetOpenChannelEnabled: true },
  vinculatedChannel: '10',
  metadata: {
    provider: 'ZAPI',
    zApiInstanceId: 'Z-1',
    zApiInstanceToken: 'TOKEN-SECRETO',
  },
  ...overrides,
})

const hubItem = (): SubscriptionItem =>
  zapiItem({
    metadata: {
      provider: 'HUBMESSAGE',
      hubmessageChannelId: 'C-9',
      wabaId: 'W-9',
    },
  })

const job = {
  kind: 'open-channel' as const,
  subscriptionItemId: 'item-1',
  domainId: 'domain-1',
  appCode: 'crmthink.thinkzap',
  instanceId: 'inst-db-1',
  providerMessageId: 'msg-1',
  destination: '5511999999999',
  text: 'Olá',
}

const contextWith = (items: SubscriptionItem[]) => ({
  subscriptions: [{ id: 'sub-1', items }],
})

describe('processWidgetOpenChannelJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDomainByIdMock.mockResolvedValue({
      id: 'domain-1',
      name: 'acme.bitrix24.com.br',
    })
    getAplicationContextMock.mockResolvedValue(contextWith([zapiItem()]))
    makeBitrixClientMock.mockResolvedValue({
      sendToOpenChannel: sendToOpenChannelMock,
    })
    sendToOpenChannelMock.mockResolvedValue({
      chatId: '4242',
      bitrixMessageId: '99',
    })
    findByProviderMessageIdMock.mockResolvedValue({
      bitrixChatId: null,
      chatId: null,
    })
    updateOpenChannelRefsMock.mockResolvedValue(undefined)
    resolveContactMock.mockResolvedValue({
      id: '5511999999999',
      phone: '5511999999999',
    })
    getCrmContactNameMock.mockResolvedValue(null)
  })

  it('abre a conversa com o canal do item e persiste as referências', async () => {
    await processWidgetOpenChannelJob(job)

    expect(sendToOpenChannelMock).toHaveBeenCalledWith(
      '10',
      'hubthink_thinkzap',
      { id: '5511999999999', name: '5511999999999', phone: '5511999999999' },
      'Olá',
    )
    expect(updateOpenChannelRefsMock).toHaveBeenCalledWith(
      'inst-db-1',
      'msg-1',
      {
        bitrixChatId: '4242',
        chatId: '5511999999999',
      },
    )
  })

  it('monta o cliente Bitrix por domínio e appCode, sem requisição HTTP', async () => {
    await processWidgetOpenChannelJob(job)

    expect(makeBitrixClientMock).toHaveBeenCalledWith(
      'acme.bitrix24.com.br',
      'crmthink.thinkzap',
    )
  })

  /**
   * Resolvido pelo id do item, não pelo `instanceId` do provider. Se o processor
   * usasse `findLineItemByInstanceId`, este caso cairia em "item não encontrado" —
   * o predicado daquela função exige `provider === 'ZAPI'`.
   */
  it('funciona para linha HubMessage (envio de template)', async () => {
    getAplicationContextMock.mockResolvedValue(contextWith([hubItem()]))

    await processWidgetOpenChannelJob(job)

    expect(sendToOpenChannelMock).toHaveBeenCalledTimes(1)
  })

  it('descarta sem lançar quando o portal não existe mais', async () => {
    getDomainByIdMock.mockResolvedValue(null)

    await expect(processWidgetOpenChannelJob(job)).resolves.toBeUndefined()
    expect(makeBitrixClientMock).not.toHaveBeenCalled()
  })

  it('descarta sem lançar quando o item saiu da instalação', async () => {
    getAplicationContextMock.mockResolvedValue(contextWith([]))

    await expect(processWidgetOpenChannelJob(job)).resolves.toBeUndefined()
    expect(makeBitrixClientMock).not.toHaveBeenCalled()
  })

  /**
   * A tradução que faz esta fila valer a pena: `EnsureWidgetOpenChannelConversation`
   * nunca lança — devolve `failed`. Sem virar exceção aqui, o BullMQ marcaria o job
   * como concluído e a retentativa nunca aconteceria.
   */
  it('lança quando a abertura falha, para o BullMQ retentar', async () => {
    sendToOpenChannelMock.mockRejectedValue(new Error('Bitrix error: 502'))

    await expect(processWidgetOpenChannelJob(job)).rejects.toThrow(
      /Falha ao abrir a conversa/,
    )
  })

  it('não lança quando a conversa já está aberta', async () => {
    findByProviderMessageIdMock.mockResolvedValue({ chatId: '4242' })

    await expect(processWidgetOpenChannelJob(job)).resolves.toBeUndefined()
    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  it('não lança quando o toggle está desligado', async () => {
    getAplicationContextMock.mockResolvedValue(
      contextWith([
        zapiItem({
          settings: {
            ...DEFAULT_CONNECTOR_SETTINGS,
            widgetOpenChannelEnabled: false,
          },
        }),
      ]),
    )

    await expect(processWidgetOpenChannelJob(job)).resolves.toBeUndefined()
    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  it('não lança quando o item não tem canal vinculado', async () => {
    getAplicationContextMock.mockResolvedValue(
      contextWith([zapiItem({ vinculatedChannel: null })]),
    )

    await expect(processWidgetOpenChannelJob(job)).resolves.toBeUndefined()
    expect(sendToOpenChannelMock).not.toHaveBeenCalled()
  })

  /** Falha de leitura do contexto é infra: tem que subir para retentar. */
  it('propaga falha de leitura do contexto da aplicação', async () => {
    getAplicationContextMock.mockRejectedValue(new Error('Bitrix fora'))

    await expect(processWidgetOpenChannelJob(job)).rejects.toThrow(
      'Bitrix fora',
    )
  })
})
