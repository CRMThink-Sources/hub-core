import { describe, expect, it, vi } from 'vitest'

import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { postOpenChannelSystemNotice } from './post-open-channel-system-notice'

/** Recusa real do canal aberto (portal `crmthinkers`, chat 9474, 2026-08-18). */
const CANCELED = {
  error: 'CANCELED',
  error_description:
    'Você não pode enviar mensagens para o bate-papo especificado.',
}

function makeClient(callMethod: ReturnType<typeof vi.fn>) {
  return { callMethod } as unknown as BitrixClient
}

const params = { botId: 1958, bitrixChatId: '9474', text: 'aviso' }

describe('postOpenChannelSystemNotice', () => {
  it('tenta o bot primeiro, com SYSTEM=Y', async () => {
    const callMethod = vi.fn().mockResolvedValue({ result: 4242 })

    const outcome = await postOpenChannelSystemNotice(
      makeClient(callMethod),
      params,
    )

    expect(callMethod).toHaveBeenCalledTimes(1)
    expect(callMethod).toHaveBeenCalledWith('imbot.message.add', {
      BOT_ID: 1958,
      DIALOG_ID: 'chat9474',
      MESSAGE: 'aviso',
      SYSTEM: 'Y',
    })
    expect(outcome).toEqual({
      posted: true,
      method: 'imbot.message.add',
      bitrixMessageId: '4242',
    })
  })

  /**
   * O caso medido: o bot supervisor não é participante da sessão de OL, e o Bitrix
   * recusa a escrita antes de olhar `SYSTEM`. O aviso então vai pelo usuário do app,
   * ainda como mensagem de serviço.
   */
  it('CANCELED do bot cai para im.message.add, também com SYSTEM=Y', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValueOnce(CANCELED)
      .mockResolvedValueOnce({ result: 777 })

    const outcome = await postOpenChannelSystemNotice(
      makeClient(callMethod),
      params,
    )

    expect(callMethod).toHaveBeenNthCalledWith(2, 'im.message.add', {
      DIALOG_ID: 'chat9474',
      MESSAGE: 'aviso',
      SYSTEM: 'Y',
    })
    expect(outcome).toEqual({
      posted: true,
      method: 'im.message.add',
      bitrixMessageId: '777',
    })
  })

  it('as duas recusas viram desfecho negativo com o motivo de cada uma', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValueOnce(CANCELED)
      .mockResolvedValueOnce({ error: 'ACCESS_DENIED' })

    const outcome = await postOpenChannelSystemNotice(
      makeClient(callMethod),
      params,
    )

    expect(outcome).toEqual({
      posted: false,
      attempts: [
        {
          method: 'imbot.message.add',
          reason:
            'Você não pode enviar mensagens para o bate-papo especificado.',
        },
        { method: 'im.message.add', reason: 'ACCESS_DENIED' },
      ],
    })
  })

  it('erro de transporte na primeira não impede a segunda', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValueOnce(new Error('bitrix fora'))
      .mockResolvedValueOnce({ result: 1 })

    const outcome = await postOpenChannelSystemNotice(
      makeClient(callMethod),
      params,
    )

    expect(callMethod).toHaveBeenCalledTimes(2)
    expect(outcome).toMatchObject({ posted: true, method: 'im.message.add' })
  })

  it('nunca lança', async () => {
    const callMethod = vi.fn().mockRejectedValue(new Error('tudo fora'))

    await expect(
      postOpenChannelSystemNotice(makeClient(callMethod), params),
    ).resolves.toMatchObject({ posted: false })
  })
})
