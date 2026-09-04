import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  BotSessionGoneError,
  isBotSessionGoneError,
} from '@/modules/thinkzap/domain/bot-flow/session-gone'
import { BitrixBotSessionAdapter } from './bitrix-bot-session.adapter'

const TOKEN = 'bot-token-1'

function makeAdapter(callMethod = vi.fn().mockResolvedValue({ result: true })) {
  const client = { callMethod } as unknown as BitrixClient
  return { adapter: new BitrixBotSessionAdapter(client, TOKEN), callMethod }
}

describe('BitrixBotSessionAdapter', () => {
  it('fala pelo bot, não pelo conector de saída', () => {
    const { adapter, callMethod } = makeAdapter()

    return adapter.say('112', 'oi').then(() => {
      // Pela sessão do bot a fala fica no histórico que o operador lê.
      expect(callMethod).toHaveBeenCalledWith(
        'imopenlines.bot.session.message.send',
        { CHAT_ID: '112', NAME: 'DEFAULT', MESSAGE: 'oi' },
      )
    })
  })

  it('`say` não manda CLIENT_ID; `transfer` e `finish` mandam', async () => {
    // Assimetria da doc do Bitrix, não descuido: `transfer` e `finish` listam
    // `CLIENT_ID` e `message.send` não declara o campo.
    const { adapter, callMethod } = makeAdapter()

    await adapter.say('112', 'oi')
    await adapter.handoff('112', { type: 'queue' })
    await adapter.finish('112')

    const chamadas = callMethod.mock.calls as Array<
      [string, Record<string, unknown>]
    >

    expect(chamadas).toHaveLength(3)
    expect(chamadas[0]?.[1]).not.toHaveProperty('CLIENT_ID')
    expect(chamadas[1]?.[1].CLIENT_ID).toBe(TOKEN)
    expect(chamadas[2]?.[1].CLIENT_ID).toBe(TOKEN)
  })

  it('fala que falha sobe: o cliente ficou sem a pergunta', async () => {
    const { adapter } = makeAdapter(
      vi.fn().mockRejectedValue(new Error('boom')),
    )

    await expect(adapter.say('112', 'oi')).rejects.toThrow('boom')
  })

  it('recusa com HTTP 200 não passa por fala entregue', async () => {
    // Medido em produção: o Bitrix nega escrita no chat com status de sucesso. Sem checar
    // o corpo, o fluxo avançaria de nó com o cliente sem ter recebido nada.
    const { adapter } = makeAdapter(
      vi.fn().mockResolvedValue({ error: 'CANCELED' }),
    )

    await expect(adapter.say('112', 'oi')).rejects.toBeInstanceOf(
      BotSessionGoneError,
    )
  })

  it('recusa desconhecida sobe como falha, não como sessão perdida', async () => {
    const { adapter } = makeAdapter(
      vi.fn().mockResolvedValue({ error: 'QUERY_LIMIT_EXCEEDED' }),
    )

    const erro = await adapter.say('112', 'oi').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(Error)
    expect(isBotSessionGoneError(erro)).toBe(false)
    expect((erro as Error).message).toContain('QUERY_LIMIT_EXCEEDED')
  })

  it('transfere pelo alvo escolhido', async () => {
    const { adapter, callMethod } = makeAdapter()

    await adapter.handoff('112', { type: 'user', bitrixUserId: '15' })

    expect(callMethod).toHaveBeenCalledWith(
      'imopenlines.bot.session.transfer',
      { CHAT_ID: '112', LEAVE: 'Y', CLIENT_ID: TOKEN, USER_ID: '15' },
    )
  })

  it('alvo sem id cai na fila em vez de estourar', async () => {
    const { adapter, callMethod } = makeAdapter()

    // Atendente que saiu do portal depois de o fluxo ser publicado.
    await adapter.handoff('112', { type: 'user', bitrixUserId: '' })

    expect(callMethod).toHaveBeenCalledTimes(1)
    expect(callMethod).toHaveBeenCalledWith(
      'imopenlines.bot.session.transfer',
      { CHAT_ID: '112', LEAVE: 'Y', CLIENT_ID: TOKEN, TRANSFER_ID: 'queue' },
    )
  })

  it('canal removido também cai na fila', async () => {
    const { adapter, callMethod } = makeAdapter()

    await adapter.handoff('112', { type: 'line', lineId: '   ' })

    expect(callMethod).toHaveBeenCalledWith(
      'imopenlines.bot.session.transfer',
      expect.objectContaining({ TRANSFER_ID: 'queue' }),
    )
  })

  it('transferência que falha sobe: o bot já se despediu', async () => {
    const { adapter } = makeAdapter(
      vi.fn().mockRejectedValue(new Error('TRANSFER_ID_EMPTY')),
    )

    await expect(adapter.handoff('112', { type: 'queue' })).rejects.toThrow(
      'TRANSFER_ID_EMPTY',
    )
  })

  it('encerramento que falha não sobe: a linha fecha por inatividade', async () => {
    const { adapter } = makeAdapter(
      vi.fn().mockRejectedValue(new Error('boom')),
    )

    await expect(adapter.finish('112')).resolves.toBeUndefined()
  })

  it('encerra pelo bot', async () => {
    const { adapter, callMethod } = makeAdapter()

    await adapter.finish('112')

    expect(callMethod).toHaveBeenCalledWith('imopenlines.bot.session.finish', {
      CHAT_ID: '112',
      CLIENT_ID: TOKEN,
    })
  })
})
