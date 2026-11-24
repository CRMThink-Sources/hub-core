import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { notifyWidgetSendOutcome } from './notify-widget-send-outcome'

const base = {
  entity: 'deal',
  entityId: '42',
  destination: '5511999999999',
  text: 'Olá',
}

const messageOf = (execute: ReturnType<typeof vi.fn>) =>
  (execute.mock.calls[0]?.[0] as { message: string }).message

describe('notifyWidgetSendOutcome', () => {
  it('o aviso sai em nome de quem tentou enviar, com a linha do remetente no idioma', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome(
      { execute },
      { ...base, outcome: 'failed', locale: 'en', authorBitrixUserId: '7' },
    )

    const input = execute.mock.calls[0]?.[0] as {
      authorBitrixUserId: string
      senderLine: (name: string) => string
    }
    expect(input.authorBitrixUserId).toBe('7')
    expect(input.senderLine('Ana')).toBe('[B]Sent by:[/B] Ana')
  })

  it('limite diário em inglês: comentário de timeline em inglês', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome(
      { execute },
      { ...base, outcome: 'daily-limit', locale: 'en' },
    )

    expect(messageOf(execute)).toContain('The message below was NOT delivered')
    expect(messageOf(execute)).toContain('[B]To:[/B] 5511999999999')
  })

  it('limite diário sem idioma: português', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome(
      { execute },
      { ...base, outcome: 'daily-limit' },
    )

    expect(messageOf(execute)).toContain('A mensagem abaixo NÃO foi entregue')
  })

  it('falha em inglês', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome(
      { execute },
      { ...base, outcome: 'failed', locale: 'en' },
    )

    expect(messageOf(execute)).toContain(
      'The message below was NOT delivered and will not be resent automatically.',
    )
    expect(messageOf(execute)).toContain('[QUOTE]Olá[/QUOTE]')
  })

  it('entrega incerta em espanhol', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome(
      { execute },
      { ...base, outcome: 'unknown', locale: 'es' },
    )

    expect(messageOf(execute)).toContain(
      'No fue posible confirmar si el mensaje de abajo salió.',
    )
  })

  it('falha sem idioma: texto de hoje, palavra por palavra', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome({ execute }, { ...base, outcome: 'failed' })

    expect(messageOf(execute)).toBe(
      '[B]⚠️ Falha no envio[/B]\n' +
        'A mensagem abaixo NÃO foi entregue e não será reenviada automaticamente.\n' +
        '[B]Para:[/B] 5511999999999\n' +
        '[QUOTE]Olá[/QUOTE]\n' +
        'Confira a conexão da linha e envie novamente pelo widget.',
    )
  })
})
