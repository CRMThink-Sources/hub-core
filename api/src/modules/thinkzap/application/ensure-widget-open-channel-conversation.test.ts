import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { EnsureWidgetOpenChannelConversation } from './ensure-widget-open-channel-conversation'

/** Prefixo do histórico em português — o padrão sem idioma da instalação. */
const PT_PREFIX = '[Mensagem enviada a partir do CRM]\n'
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
  const updateOpenChannelRefs = vi.fn().mockResolvedValue(undefined)

  const sut = new EnsureWidgetOpenChannelConversation(
    { sendToOpenChannel },
    { findByProviderMessageId, updateOpenChannelRefs },
  )

  return {
    sut,
    sendToOpenChannel,
    findByProviderMessageId,
    updateOpenChannelRefs,
  }
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
    // Identidade, nome e telefone chegam separados — antes eram o mesmo valor nos cinco
    // campos do payload, e foi isso que faria o lid virar nome do contato.
    expect(sendToOpenChannel).toHaveBeenCalledWith(
      '10',
      expect.any(String),
      { id: '5511999999999', name: '5511999999999', phone: '5511999999999' },
      'Olá',
      PT_PREFIX,
    )
  })

  /**
   * As duas colunas, nos papéis que o inbound já usa: a sessão do Bitrix em
   * `bitrixChatId` e a identidade do contato em `chatId`. Antes a sessão ia para
   * `chatId`, invertendo o sentido da coluna e escondendo sob qual identidade o
   * contato entrou no canal aberto — a informação necessária para diagnosticar canal
   * aberto duplicado.
   */
  it('persiste a sessão e a identidade do contato na mensagem que abriu a conversa', async () => {
    const { sut, updateOpenChannelRefs } = makeSut()

    await sut.execute({ ...baseInput, item: item() })

    expect(updateOpenChannelRefs).toHaveBeenCalledWith(
      'inst-uuid-1',
      'Z-MSG-1',
      { bitrixChatId: '4242', chatId: '5511999999999' },
    )
  })

  /**
   * A identidade gravada é a canônica, não o que o operador digitou. É o que faz a
   * row descrever a mesma sessão em que o inbound do contato vai cair.
   */
  it('grava a identidade canônica quando o destino chega em outra forma', async () => {
    const { sut, updateOpenChannelRefs } = makeSut()

    await sut.execute({
      ...baseInput,
      destination: '554792259475',
      item: item(),
    })

    expect(updateOpenChannelRefs).toHaveBeenCalledWith(
      'inst-uuid-1',
      'Z-MSG-1',
      { bitrixChatId: '4242', chatId: '5547992259475' },
    )
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
      expect.any(Object),
      expect.any(String),
      PT_PREFIX,
    )
  })

  /**
   * A identidade deixou de ser canonizada dentro do cliente do Bitrix: em linha Z-API
   * ela é o LID, e chegar nele pode custar o mapa e uma consulta ao provider. Quem
   * resolve é quem sabe o provider da linha.
   */
  it('usa a identidade que o resolvedor devolve, não o telefone', async () => {
    const sendToOpenChannel = vi
      .fn()
      .mockResolvedValue({ chatId: '4242', bitrixMessageId: '99' })

    const sut = new EnsureWidgetOpenChannelConversation(
      { sendToOpenChannel },
      {
        findByProviderMessageId: vi.fn().mockResolvedValue(null),
        updateOpenChannelRefs: vi.fn().mockResolvedValue(undefined),
      },
      () =>
        Promise.resolve({ id: '3577724534928@lid', phone: '5511999999999' }),
    )

    await sut.execute({ ...baseInput, item: item() })

    expect(sendToOpenChannel).toHaveBeenCalledWith(
      '10',
      expect.any(String),
      expect.objectContaining({ id: '3577724534928@lid' }),
      'Olá',
      PT_PREFIX,
    )
  })

  /** O nome vem do CRM quando a entidade de origem existe. */
  it('nomeia a conversa com o contato do CRM', async () => {
    const sendToOpenChannel = vi
      .fn()
      .mockResolvedValue({ chatId: '4242', bitrixMessageId: '99' })

    const sut = new EnsureWidgetOpenChannelConversation(
      { sendToOpenChannel },
      {
        findByProviderMessageId: vi.fn().mockResolvedValue(null),
        updateOpenChannelRefs: vi.fn().mockResolvedValue(undefined),
      },
      () =>
        Promise.resolve({ id: '3577724534928@lid', phone: '5511999999999' }),
      () => Promise.resolve('Maria Souza'),
    )

    await sut.execute({
      ...baseInput,
      item: item(),
      entity: 'contact',
      entityId: '42',
    })

    expect(sendToOpenChannel).toHaveBeenCalledWith(
      '10',
      expect.any(String),
      expect.objectContaining({ name: 'Maria Souza' }),
      'Olá',
      PT_PREFIX,
    )
  })

  /**
   * A mensagem já foi entregue ao contato quando isto roda: recusar a conversa por
   * causa de um nome trocaria um problema cosmético por uma conversa que não existe.
   */
  it('abre a conversa mesmo quando a consulta ao CRM falha', async () => {
    const sendToOpenChannel = vi
      .fn()
      .mockResolvedValue({ chatId: '4242', bitrixMessageId: '99' })

    const sut = new EnsureWidgetOpenChannelConversation(
      { sendToOpenChannel },
      {
        findByProviderMessageId: vi.fn().mockResolvedValue(null),
        updateOpenChannelRefs: vi.fn().mockResolvedValue(undefined),
      },
      () => Promise.resolve({ id: 'lid@lid', phone: '5511999999999' }),
      () => Promise.reject(new Error('bitrix fora')),
    )

    const result = await sut.execute({
      ...baseInput,
      item: item(),
      entity: 'contact',
      entityId: '42',
    })

    expect(result.outcome).toBe('opened')
    expect(sendToOpenChannel).toHaveBeenCalledWith(
      '10',
      expect.any(String),
      expect.objectContaining({ name: '5511999999999' }),
      'Olá',
      PT_PREFIX,
    )
  })

  /**
   * A resolução pode custar uma consulta ao provider — conversa que já existe não deve
   * pagar por ela.
   */
  it('não resolve identidade nem nome quando a conversa já está aberta', async () => {
    const resolveContact = vi.fn()
    const getCrmName = vi.fn()

    const sut = new EnsureWidgetOpenChannelConversation(
      { sendToOpenChannel: vi.fn() },
      {
        findByProviderMessageId: vi
          .fn()
          .mockResolvedValue({ bitrixChatId: '4242', chatId: 'x' }),
        updateOpenChannelRefs: vi.fn(),
      },
      resolveContact,
      getCrmName,
    )

    const result = await sut.execute({
      ...baseInput,
      item: item(),
      entity: 'contact',
      entityId: '42',
    })

    expect(result.outcome).toBe('already-open')
    expect(resolveContact).not.toHaveBeenCalled()
    expect(getCrmName).not.toHaveBeenCalled()
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

  it('recusa com already-open quando a mensagem já tem bitrixChatId', async () => {
    const { sut, sendToOpenChannel, findByProviderMessageId } = makeSut()
    findByProviderMessageId.mockResolvedValue({
      bitrixChatId: '4242',
      chatId: '5511999999999',
    })

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({ outcome: 'already-open', chatId: '4242' })
    expect(sendToOpenChannel).not.toHaveBeenCalled()
  })

  /**
   * A row gravada antes desta mudança guarda a sessão em `chatId` e tem
   * `bitrixChatId` nulo. Sem o fallback ela pareceria "conversa não aberta", e uma
   * retentativa do job re-postaria no canal do cliente.
   */
  it('reconhece row antiga com a sessão em chatId', async () => {
    const { sut, sendToOpenChannel, findByProviderMessageId } = makeSut()
    findByProviderMessageId.mockResolvedValue({
      bitrixChatId: null,
      chatId: '4242',
    })

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({ outcome: 'already-open', chatId: '4242' })
    expect(sendToOpenChannel).not.toHaveBeenCalled()
  })

  it('abre quando a mensagem existe mas está sem as duas referências', async () => {
    const { sut, sendToOpenChannel, findByProviderMessageId } = makeSut()
    findByProviderMessageId.mockResolvedValue({
      bitrixChatId: null,
      chatId: null,
    })

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result.outcome).toBe('opened')
    expect(sendToOpenChannel).toHaveBeenCalledTimes(1)
  })

  it('não propaga erro do Bitrix — devolve failed', async () => {
    const { sut, sendToOpenChannel, updateOpenChannelRefs } = makeSut()
    sendToOpenChannel.mockRejectedValue(new Error('Bitrix error: 400'))

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({
      outcome: 'failed',
      chatId: null,
      error: 'Bitrix error: 400',
    })
    expect(updateOpenChannelRefs).not.toHaveBeenCalled()
  })

  /**
   * Resposta sem `session.CHAT_ID` não é erro: a mensagem entrou no canal. Tratar
   * como falha pediria uma retentativa que duplicaria a postagem.
   */
  it('trata resposta sem CHAT_ID como opened, sem persistir nada', async () => {
    const { sut, sendToOpenChannel, updateOpenChannelRefs } = makeSut()
    sendToOpenChannel.mockResolvedValue({ chatId: null, bitrixMessageId: null })

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result).toEqual({ outcome: 'opened', chatId: null })
    expect(updateOpenChannelRefs).not.toHaveBeenCalled()
  })

  it('falha de leitura da mensagem não impede a abertura', async () => {
    const { sut, sendToOpenChannel, findByProviderMessageId } = makeSut()
    findByProviderMessageId.mockRejectedValue(new Error('db down'))

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result.outcome).toBe('opened')
    expect(sendToOpenChannel).toHaveBeenCalledTimes(1)
  })

  it('falha ao persistir as referências não transforma opened em failed', async () => {
    const { sut, updateOpenChannelRefs } = makeSut()
    updateOpenChannelRefs.mockRejectedValue(new Error('db down'))

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

describe('EnsureWidgetOpenChannelConversation idioma do histórico', () => {
  const sutWith = (resolveLocale: () => Promise<'pt' | 'en' | 'es'>) => {
    const sendToOpenChannel = vi
      .fn()
      .mockResolvedValue({ chatId: '4242', bitrixMessageId: '99' })
    const sut = new EnsureWidgetOpenChannelConversation(
      { sendToOpenChannel },
      {
        findByProviderMessageId: vi.fn().mockResolvedValue(null),
        updateOpenChannelRefs: vi.fn().mockResolvedValue(undefined),
      },
      undefined,
      undefined,
      resolveLocale,
    )
    return { sut, sendToOpenChannel }
  }

  it('prefixo em inglês, mensagem como foi escrita', async () => {
    const { sut, sendToOpenChannel } = sutWith(() => Promise.resolve('en'))

    await sut.execute({ ...baseInput, item: item() })

    expect(sendToOpenChannel.mock.calls[0]?.[3]).toBe('Olá')
    expect(sendToOpenChannel.mock.calls[0]?.[4]).toBe(
      '[Message sent from the CRM]\n',
    )
  })

  it('idioma não é lido quando a conversa não vai ser postada', async () => {
    const resolveLocale = vi.fn(() => Promise.resolve('en' as const))
    const { sut } = sutWith(resolveLocale)

    await sut.execute({
      ...baseInput,
      item: item({ vinculatedChannel: null }),
    })

    expect(resolveLocale).not.toHaveBeenCalled()
  })

  it('falha ao ler o idioma: posta em português, sem falhar', async () => {
    const { sut, sendToOpenChannel } = sutWith(() =>
      Promise.reject(new Error('db fora')),
    )

    const result = await sut.execute({ ...baseInput, item: item() })

    expect(result.outcome).toBe('opened')
    expect(sendToOpenChannel.mock.calls[0]?.[4]).toBe(PT_PREFIX)
  })
})
