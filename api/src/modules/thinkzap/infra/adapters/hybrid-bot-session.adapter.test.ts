import { describe, expect, it, vi } from 'vitest'
import type { BotSessionPort } from '@/modules/thinkzap/domain/ports/bot-session.port'
import type { OutboundMessageSender } from '@/modules/thinkzap/domain/ports/outbound-message-sender.port'
import { HybridBotSessionAdapter } from './hybrid-bot-session.adapter'
import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import { sendWithinDailyQuota } from '@/modules/thinkzap/application/helpers/send-within-daily-quota'

const CHAT = '1822'

function setup(
  over: {
    ecoFalha?: boolean
    contatoFalha?: boolean
  } = {},
) {
  const ordem: string[] = []

  const ecoSay = vi.fn((_chatId: string, _text: string) => {
    ordem.push('eco')
    return over.ecoFalha
      ? Promise.reject(new Error('chat fechou'))
      : Promise.resolve()
  })
  const ecoHandoff = vi.fn((_chatId: string, _target: unknown) =>
    Promise.resolve(),
  )
  const ecoFinish = vi.fn((_chatId: string) => Promise.resolve())
  const ecoWhisper = vi.fn((_chatId: string, _text: string) =>
    Promise.resolve(),
  )

  const eco: BotSessionPort = {
    say: ecoSay,
    whisper: ecoWhisper,
    handoff: ecoHandoff,
    finish: ecoFinish,
  }

  const send = vi.fn((_descriptor: unknown) => {
    ordem.push('contato')
    return over.contatoFalha
      ? Promise.reject(new Error('z-api fora'))
      : Promise.resolve({
          messageId: 'm-1',
          persistedType: 'TEXT' as const,
          sentText: 'oi',
        })
  })

  const contato = { supportsReply: false, send } as OutboundMessageSender

  return {
    adapter: new HybridBotSessionAdapter(eco, contato),
    ecoSay,
    ecoHandoff,
    ecoFinish,
    send,
    ordem,
  }
}

describe('HybridBotSessionAdapter', () => {
  it('entrega ao contato e ecoa no chat', async () => {
    // Medido em produção: a fala pelo bot aparece no chat do Bitrix e não atravessa o
    // conector, então quem entrega ao cliente é o sender do operador.
    const { adapter, send, ecoSay } = setup()

    await adapter.say(CHAT, 'oi')

    expect(send).toHaveBeenCalledWith({ kind: 'text', text: 'oi' })
    expect(ecoSay).toHaveBeenCalledWith(CHAT, 'oi')
  })

  it('contato antes do eco', async () => {
    // A entrega é o que não pode faltar; o histórico vem depois dela.
    const { adapter, ordem } = setup()

    await adapter.say(CHAT, 'oi')

    expect(ordem).toEqual(['contato', 'eco'])
  })

  it('falha na entrega ao contato sobe', async () => {
    // O cliente ficou sem a mensagem: o worker precisa retentar.
    const { adapter } = setup({ contatoFalha: true })

    await expect(adapter.say(CHAT, 'oi')).rejects.toThrow('z-api fora')
  })

  it('falha no eco não sobe: o cliente já recebeu', async () => {
    // Propagar faria o worker retentar o turno e mandar a mesma fala de novo ao contato.
    const { adapter, send } = setup({ ecoFalha: true })

    await expect(adapter.say(CHAT, 'oi')).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledOnce()
  })

  it('handoff e finish não vão ao contato', async () => {
    // São operações de sessão do canal aberto, não mensagem ao cliente.
    const { adapter, send, ecoHandoff, ecoFinish } = setup()

    await adapter.handoff(CHAT, { type: 'queue' })
    await adapter.finish(CHAT)

    expect(ecoHandoff).toHaveBeenCalledWith(CHAT, { type: 'queue' })
    expect(ecoFinish).toHaveBeenCalledWith(CHAT)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('HybridBotSessionAdapter limite diário', () => {
  it('fala recusada pelo limite: contato não recebe, eco não acontece e não lança', async () => {
    const ecoSay = vi.fn(() => Promise.resolve())
    const eco: BotSessionPort = {
      say: ecoSay,
      whisper: vi.fn(),
      handoff: vi.fn(),
      finish: vi.fn(),
    }
    const send = vi.fn<OutboundMessageSender['send']>()
    const quota = {
      reserve: vi.fn().mockResolvedValue({
        status: 'refused',
        counts: { sent: 10, extra: 0 },
        effectiveLimit: 10,
      }),
    } as unknown as DailySendQuota
    const contato: OutboundMessageSender = {
      supportsReply: false,
      send: (descriptor, options) =>
        sendWithinDailyQuota(
          quota,
          { lineKey: 'Z-1', enabled: true, limit: 10 },
          () => send(descriptor, options),
        ),
    }
    const onDailyLimitReached = vi.fn(() => Promise.resolve())
    const adapter = new HybridBotSessionAdapter(
      eco,
      contato,
      onDailyLimitReached,
    )

    await expect(adapter.say(CHAT, 'Olá!')).resolves.toBeUndefined()

    expect(send).not.toHaveBeenCalled()
    expect(ecoSay).not.toHaveBeenCalled()
    expect(onDailyLimitReached).toHaveBeenCalledWith(CHAT)
  })
})
