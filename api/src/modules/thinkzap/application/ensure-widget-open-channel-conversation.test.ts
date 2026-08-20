import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { EnsureWidgetOpenChannelConversation } from './ensure-widget-open-channel-conversation'

const item = (overrides: Partial<SubscriptionItem> = {}): SubscriptionItem => ({
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

function makeSut() {
  const sendToOpenChannel = vi
    .fn()
    .mockResolvedValue({ chatId: '4242', bitrixMessageId: '99' })
  const findByProviderMessageId = vi.fn().mockResolvedValue(null)
  const updateChatId = vi.fn().mockResolvedValue(undefined)

  const sut = new EnsureWidgetOpenChannelConversation(
    { sendToOpenChannel },
    { findByProviderMessageId, updateChatId },
  )

  return { sut, sendToOpenChannel, findByProviderMessageId, updateChatId }
}

const baseInput = {
  instanceId: 'inst-uuid-1',
  providerMessageId: 'Z-MSG-1',
  destination: '5511999999999',
  text: 'Olá',
}

describe('EnsureWidgetOpenChannelConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('abre a conversa e devolve o chatId', async () => {
    const { sut, sendToOpenChannel } = makeSut()

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({ outcome: 'opened', chatId: '4242' })
    expect(sendToOpenChannel).toHaveBeenCalledWith(
      '10',
      expect.any(String),
      '5511999999999',
      'Olá',
    )
  })

  it('persiste o chatId na mensagem que abriu a conversa', async () => {
    const { sut, updateChatId } = makeSut()

    await sut.execute({ ...baseInput, item: item() })

    expect(updateChatId).toHaveBeenCalledWith('inst-uuid-1', 'Z-MSG-1', '4242')
  })

  /**
   * O canal e o toggle saem do **item**, não da row de `Instance`. É a correção da
   * causa raiz: `Instance.vinculatedChannel` está `NULL` em toda linha cuja âncora
   * nasceu antes do vínculo, e era esse campo que recusava o envio.
   */
  it('decide pelo vinculatedChannel do item', async () => {
    const { sut, sendToOpenChannel } = makeSut()

    await sut.execute({ ...baseInput, item: item({ vinculatedChannel: '77' }) })

    expect(sendToOpenChannel).toHaveBeenCalledWith(
      '77',
      expect.any(String),
      expect.any(String),
      expect.any(String),
    )
  })

  it('recusa com no-channel quando o item não tem canal vinculado', async () => {
    const { sut, sendToOpenChannel } = makeSut()

    const result = await sut.execute({
      ...baseInput,
      item: item({ vinculatedChannel: null }),
    })

    expect(result).toEqual({ outcome: 'no-channel', chatId: null })
    expect(sendToOpenChannel).not.toHaveBeenCalled()
  })

  it('recusa com toggle-off quando widgetOpenChannelEnabled é false', async () => {
    const { sut, sendToOpenChannel } = makeSut()

    const result = await sut.execute({
      ...baseInput,
      item: item({
        settings: {
          ...DEFAULT_CONNECTOR_SETTINGS,
          widgetOpenChannelEnabled: false,
        },
      }),
    })

    expect(result).toEqual({ outcome: 'toggle-off', chatId: null })
    expect(sendToOpenChannel).not.toHaveBeenCalled()
  })

  /**
   * Toggle ligado em linha sem canal é estado impossível — a UI desabilita o toggle.
   * Responder "desligado" descreveria errado o motivo para quem lê o log.
   */
  it('avalia o canal antes do toggle', async () => {
    const { sut } = makeSut()

    const result = await sut.execute({
      ...baseInput,
      item: item({
        vinculatedChannel: null,
        settings: {
          ...DEFAULT_CONNECTOR_SETTINGS,
          widgetOpenChannelEnabled: false,
        },
      }),
    })

    expect(result.outcome).toBe('no-channel')
  })

  it('recusa com already-open quando a mensagem já tem chatId', async () => {
    const { sut, sendToOpenChannel, findByProviderMessageId } = makeSut()
    findByProviderMessageId.mockResolvedValue({ chatId: '4242' })

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({ outcome: 'already-open', chatId: '4242' })
    expect(sendToOpenChannel).not.toHaveBeenCalled()
  })

  it('abre quando a mensagem existe mas está sem chatId', async () => {
    const { sut, sendToOpenChannel, findByProviderMessageId } = makeSut()
    findByProviderMessageId.mockResolvedValue({ chatId: null })

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result.outcome).toBe('opened')
    expect(sendToOpenChannel).toHaveBeenCalledTimes(1)
  })

  it('não propaga erro do Bitrix — devolve failed', async () => {
    const { sut, sendToOpenChannel, updateChatId } = makeSut()
    sendToOpenChannel.mockRejectedValue(new Error('Bitrix error: 400'))

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({ outcome: 'failed', chatId: null })
    expect(updateChatId).not.toHaveBeenCalled()
  })

  /**
   * Resposta sem `session.CHAT_ID` não é erro: a mensagem entrou no canal. Tratar
   * como falha pediria uma retentativa que duplicaria a postagem.
   */
  it('trata resposta sem CHAT_ID como opened, sem persistir nada', async () => {
    const { sut, sendToOpenChannel, updateChatId } = makeSut()
    sendToOpenChannel.mockResolvedValue({ chatId: null, bitrixMessageId: null })

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({ outcome: 'opened', chatId: null })
    expect(updateChatId).not.toHaveBeenCalled()
  })

  it('falha de leitura da mensagem não impede a abertura', async () => {
    const { sut, sendToOpenChannel, findByProviderMessageId } = makeSut()
    findByProviderMessageId.mockRejectedValue(new Error('db down'))

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result.outcome).toBe('opened')
    expect(sendToOpenChannel).toHaveBeenCalledTimes(1)
  })

  it('falha ao persistir o chatId não transforma opened em failed', async () => {
    const { sut, updateChatId } = makeSut()
    updateChatId.mockRejectedValue(new Error('db down'))

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({ outcome: 'opened', chatId: '4242' })
  })

  it('abre a conversa para linha HubMessage do mesmo jeito', async () => {
    const { sut, sendToOpenChannel } = makeSut()

    const result = await sut.execute({
      ...baseInput,
      item: item({
        metadata: {
          provider: 'HUBMESSAGE',
          hubmessageChannelId: 'C-9',
          wabaId: 'W-9',
        },
      }),
    })

    expect(result.outcome).toBe('opened')
    expect(sendToOpenChannel).toHaveBeenCalledTimes(1)
  })
})
