/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import {
  ButtonProviderUnavailableError,
  InvalidButtonCombinationError,
  UnsupportedButtonTypeError,
} from '@/modules/thinkzap/domain/ports/button-errors'
import { HubMessageApiError } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import type { HubMessageClient } from '@/modules/thinkzap/infra/clients/hubmessage.client'
import { HubMessageInteractiveButtonSender } from './hubmessage-interactive-button-sender.adapter'

function makeClient(overrides: Partial<HubMessageClient> = {}) {
  return {
    sendInteractiveAction: vi.fn().mockResolvedValue({ messageId: 'msg_1' }),
    sendInteractiveButton: vi.fn().mockResolvedValue({ messageId: 'msg_1' }),
    ...overrides,
  } as unknown as HubMessageClient
}

function makeSender(client: HubMessageClient) {
  return new HubMessageInteractiveButtonSender(client, {
    channelId: 'chan_1',
    recipientIdentifier: '5511999999999',
  })
}

describe('HubMessageInteractiveButtonSender', () => {
  it('envia um único botão URL e devolve o messageId do provider', async () => {
    const client = makeClient()

    const result = await makeSender(client).send({
      body: 'How can we help?',
      header: 'Hub Message',
      footer: 'Choose an option',
      buttons: [
        {
          id: '1',
          label: 'Visit our site',
          type: 'URL',
          url: 'https://www.hubmessage.io',
        },
      ],
    })

    expect(client.sendInteractiveAction).toHaveBeenCalledWith('chan_1', {
      recipient: { identifier: '5511999999999' },
      content: {
        type: 'INTERACTIVE_ACTION',
        header: { message: 'Hub Message' },
        body: { message: 'How can we help?' },
        footer: { message: 'Choose an option' },
        attachments: [
          {
            id: '1',
            title: 'Visit our site',
            name: 'URL',
            url: 'https://www.hubmessage.io',
          },
        ],
      },
    })
    expect(result).toEqual({ messageId: 'msg_1' })
  })

  /**
   * A Cloud API da Meta não tem botão de ligação em mensagem de sessão livre
   * (só template aprovado) — confirmado contra a API real em 2026-09-15,
   * apesar de a doc da HubMessage documentar o tipo `CALL` neste endpoint.
   */
  it('recusa botão CALL antes de chamar o provider', async () => {
    const client = makeClient()

    await expect(
      makeSender(client).send({
        body: 'uma mensagem',
        buttons: [
          { id: '1', label: 'Ligar', type: 'CALL', phone: '5511999999999' },
        ],
      }),
    ).rejects.toBeInstanceOf(UnsupportedButtonTypeError)

    expect(client.sendInteractiveAction).not.toHaveBeenCalled()
  })

  /**
   * O botão de URL da Meta (`cta_url`) é de um botão só por mensagem —
   * confirmado contra a API real: dois botões juntos fizeram a Meta
   * descartar o segundo silenciosamente, sem erro.
   */
  it('recusa mais de um botão antes de chamar o provider', async () => {
    const client = makeClient()

    await expect(
      makeSender(client).send({
        body: 'uma mensagem',
        buttons: [
          { id: '1', label: 'Site', type: 'URL', url: 'https://x.io' },
          { id: '2', label: 'Outro site', type: 'URL', url: 'https://y.io' },
        ],
      }),
    ).rejects.toThrow('aceita no máximo 1 botão')

    expect(client.sendInteractiveAction).not.toHaveBeenCalled()
  })

  it('omite header e footer quando ausentes', async () => {
    const client = makeClient()

    await makeSender(client).send({
      body: 'sem header nem footer',
      buttons: [{ id: '1', label: 'Site', type: 'URL', url: 'https://x.io' }],
    })

    const params = vi.mocked(client.sendInteractiveAction).mock.calls[0]?.[1]
    expect(params?.content).not.toHaveProperty('header')
    expect(params?.content).not.toHaveProperty('footer')
  })

  it('envia botões REPLY por sendInteractiveButton, sem header/footer', async () => {
    const client = makeClient()

    const result = await makeSender(client).send({
      body: 'Como você avalia o atendimento?',
      header: 'ignorado',
      footer: 'ignorado',
      buttons: [
        { id: '1', label: 'Ótimo', type: 'REPLY' },
        { id: '2', label: 'Bom', type: 'REPLY' },
        { id: '3', label: 'Regular', type: 'REPLY' },
      ],
    })

    expect(client.sendInteractiveButton).toHaveBeenCalledWith('chan_1', {
      recipient: { identifier: '5511999999999' },
      content: {
        type: 'INTERACTIVE_BUTTON',
        body: { message: 'Como você avalia o atendimento?' },
        attachments: [
          { id: '1', title: 'Ótimo' },
          { id: '2', title: 'Bom' },
          { id: '3', title: 'Regular' },
        ],
      },
    })
    expect(client.sendInteractiveAction).not.toHaveBeenCalled()
    expect(result).toEqual({ messageId: 'msg_1' })
  })

  it('recusa o 4º botão REPLY antes de chamar o provider', async () => {
    const client = makeClient()

    await expect(
      makeSender(client).send({
        body: 'uma mensagem',
        buttons: [
          { id: '1', label: 'A', type: 'REPLY' },
          { id: '2', label: 'B', type: 'REPLY' },
          { id: '3', label: 'C', type: 'REPLY' },
          { id: '4', label: 'D', type: 'REPLY' },
        ],
      }),
    ).rejects.toThrow('aceita no máximo 3 botão')

    expect(client.sendInteractiveButton).not.toHaveBeenCalled()
    expect(client.sendInteractiveAction).not.toHaveBeenCalled()
  })

  it('recusa REPLY misturado com URL antes de chamar o provider', async () => {
    const client = makeClient()

    await expect(
      makeSender(client).send({
        body: 'uma mensagem',
        buttons: [
          { id: '1', label: 'Sim', type: 'REPLY' },
          { id: '2', label: 'Site', type: 'URL', url: 'https://x.io' },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidButtonCombinationError)

    expect(client.sendInteractiveButton).not.toHaveBeenCalled()
    expect(client.sendInteractiveAction).not.toHaveBeenCalled()
  })

  it('propaga a recusa de negócio (ex.: janela de 24h fechada) com a mensagem do provider', async () => {
    const apiError = new HubMessageApiError(
      422,
      'POST',
      '/v1/channels/chan_1/messages',
      { message: 'conversation window closed' },
      new Error('boom'),
    )
    const client = makeClient({
      sendInteractiveAction: vi.fn().mockRejectedValue(apiError),
    } as unknown as Partial<HubMessageClient>)

    await expect(
      makeSender(client).send({
        body: 'uma mensagem',
        buttons: [{ id: '1', label: 'Site', type: 'URL', url: 'https://x.io' }],
      }),
    ).rejects.toThrow('conversation window closed')
  })

  it('traduz indisponibilidade do provider em erro de domínio', async () => {
    const apiError = new HubMessageApiError(
      502,
      'POST',
      '/v1/channels/chan_1/messages',
      { error: 'barling returned status 502' },
      new Error('boom'),
    )
    const client = makeClient({
      sendInteractiveAction: vi.fn().mockRejectedValue(apiError),
    } as unknown as Partial<HubMessageClient>)

    await expect(
      makeSender(client).send({
        body: 'uma mensagem',
        buttons: [{ id: '1', label: 'Site', type: 'URL', url: 'https://x.io' }],
      }),
    ).rejects.toBeInstanceOf(ButtonProviderUnavailableError)
  })
})
