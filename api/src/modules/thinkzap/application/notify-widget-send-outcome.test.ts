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
  it('limite diário em inglês: comentário de timeline em inglês', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome(
      { execute },
      { ...base, outcome: 'daily-limit', locale: 'en' },
    )

    expect(messageOf(execute)).toContain('The message below was NOT delivered')
    expect(messageOf(execute)).toContain('To: 5511999999999')
  })

  it('limite diário sem idioma: português', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome(
      { execute },
      { ...base, outcome: 'daily-limit' },
    )

    expect(messageOf(execute)).toContain('A mensagem abaixo NÃO foi entregue')
  })

  it('outros desfechos não mudam com o idioma', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await notifyWidgetSendOutcome(
      { execute },
      { ...base, outcome: 'failed', locale: 'en' },
    )

    expect(messageOf(execute)).toContain('não será reenviada')
  })
})
