/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import { InvalidButtonCombinationError } from '@/modules/thinkzap/domain/ports/button-errors'
import type { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { ZApiInteractiveButtonSender } from './z-api-interactive-button-sender.adapter'

function makeClient(overrides: Partial<ZApiClient> = {}) {
  return {
    sendButtonActions: vi
      .fn()
      .mockResolvedValue({ zaapId: 'zaap_1', messageId: 'msg_1', id: 'msg_1' }),
    ...overrides,
  } as unknown as ZApiClient
}

function makeSender(client: ZApiClient) {
  return new ZApiInteractiveButtonSender(client, {
    instanceId: 'inst_1',
    instanceToken: 'token_1',
    phone: '5511999999999',
  })
}

describe('ZApiInteractiveButtonSender', () => {
  it('envia CALL e URL juntos e devolve o messageId do provider', async () => {
    const client = makeClient()

    const result = await makeSender(client).send({
      body: 'uma mensagem',
      header: 'título',
      footer: 'rodapé',
      buttons: [
        { id: '1', label: 'Ligar', type: 'CALL', phone: '554498398733' },
        { id: '2', label: 'Site', type: 'URL', url: 'https://z-api.io' },
      ],
    })

    expect(client.sendButtonActions).toHaveBeenCalledWith('inst_1', 'token_1', {
      phone: '5511999999999',
      message: 'uma mensagem',
      title: 'título',
      footer: 'rodapé',
      buttonActions: [
        { id: '1', type: 'CALL', label: 'Ligar', phone: '554498398733' },
        { id: '2', type: 'URL', label: 'Site', url: 'https://z-api.io' },
      ],
    })
    expect(result).toEqual({ messageId: 'msg_1' })
  })

  it('envia apenas botões REPLY sem erro', async () => {
    const client = makeClient()

    await makeSender(client).send({
      body: 'escolha uma opção',
      buttons: [
        { id: '1', label: 'Sim', type: 'REPLY' },
        { id: '2', label: 'Não', type: 'REPLY' },
      ],
    })

    expect(client.sendButtonActions).toHaveBeenCalled()
  })

  it('recusa misturar REPLY com URL antes de chamar o provider', async () => {
    const client = makeClient()

    await expect(
      makeSender(client).send({
        body: 'uma mensagem',
        buttons: [
          { id: '1', label: 'Sim', type: 'REPLY' },
          { id: '2', label: 'Site', type: 'URL', url: 'https://z-api.io' },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidButtonCombinationError)

    expect(client.sendButtonActions).not.toHaveBeenCalled()
  })

  it('recusa misturar REPLY com CALL antes de chamar o provider', async () => {
    const client = makeClient()

    await expect(
      makeSender(client).send({
        body: 'uma mensagem',
        buttons: [
          { id: '1', label: 'Sim', type: 'REPLY' },
          { id: '2', label: 'Ligar', type: 'CALL', phone: '554498398733' },
        ],
      }),
    ).rejects.toBeInstanceOf(InvalidButtonCombinationError)

    expect(client.sendButtonActions).not.toHaveBeenCalled()
  })

  it('omite title e footer quando ausentes', async () => {
    const client = makeClient()

    await makeSender(client).send({
      body: 'uma mensagem',
      buttons: [
        { id: '1', label: 'Site', type: 'URL', url: 'https://z-api.io' },
      ],
    })

    const params = vi.mocked(client.sendButtonActions).mock.calls[0]?.[2]
    expect(params).not.toHaveProperty('title')
    expect(params).not.toHaveProperty('footer')
  })
})
