import { describe, expect, it, vi } from 'vitest'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  BotSessionGoneError,
  isBotSessionGoneError,
} from '@/modules/thinkzap/domain/bot-flow/session-gone'
import { BitrixBotSessionAdapter } from './bitrix-bot-session.adapter'

const TOKEN = 'bot-token-1'
const BOT_ID = 2088

function makeAdapter(callMethod = vi.fn().mockResolvedValue({ result: true })) {
  const client = { callMethod } as unknown as BitrixClient
  return {
    adapter: new BitrixBotSessionAdapter(client, TOKEN, BOT_ID),
    callMethod,
  }
}

describe('BitrixBotSessionAdapter', () => {
  it('fala como participante, para o conector repassar ao WhatsApp', async () => {
    // Medido em produção: `imopenlines.bot.session.message.send` cria mensagem
    // automática da linha, que o Bitrix não entrega ao conector — ficava só no chat.
    const { adapter, callMethod } = makeAdapter()

    await adapter.say('112', 'oi')

    expect(callMethod).toHaveBeenCalledWith('imbot.v2.Chat.Message.send', {
      botId: BOT_ID,
      botToken: TOKEN,
      dialogId: 'chat112',
      fields: { message: 'oi', system: false },
    })
  })

  it('nunca manda `system: true`', async () => {
    // É o campo que decide a entrega: mensagem de sistema aparece cinza no chat e o
    // canal aberto não a repassa ao conector.
    const { adapter, callMethod } = makeAdapter()

    await adapter.say('112', 'oi')

    const [, params] = callMethod.mock.calls[0] as [
      string,
      { fields: { system: boolean } },
    ]
    expect(params.fields.system).toBe(false)
  })

  it('`transfer` e `finish` mandam CLIENT_ID; o `say` usa `botToken`', async () => {
    // Assimetria da doc do Bitrix: os métodos de sessão nomeiam `CLIENT_ID`, e o
    // `imbot.v2.*` chama o mesmo segredo de `botToken`.
    const { adapter, callMethod } = makeAdapter()

    await adapter.say('112', 'oi')
    await adapter.handoff('112', { type: 'queue' })
    await adapter.finish('112')

    const chamadas = callMethod.mock.calls as Array<
      [string, Record<string, unknown>]
    >

    expect(chamadas).toHaveLength(3)
    expect(chamadas[0]?.[1].botToken).toBe(TOKEN)
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

    await adapter.handoff('112', { type: 'evenly', bitrixUserIds: ['15'] })

    expect(callMethod).toHaveBeenCalledWith(
      'imopenlines.bot.session.transfer',
      { CHAT_ID: '112', LEAVE: 'Y', CLIENT_ID: TOKEN, USER_ID: '15' },
    )
  })

  it('alvo sem id cai na fila em vez de estourar', async () => {
    const { adapter, callMethod } = makeAdapter()

    // Atendente que saiu do portal depois de o fluxo ser publicado.
    await adapter.handoff('112', { type: 'evenly', bitrixUserIds: [''] })

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
