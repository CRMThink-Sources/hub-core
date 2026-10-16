import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/infra/logger', () => ({
  createWorkerSourceLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import {
  DAILY_LIMIT_NOTICE,
  notifyOperatorDailyLimitReached,
} from './notify-operator-daily-limit-reached'

const clientWith = (callMethod: ReturnType<typeof vi.fn>) =>
  ({ callMethod }) as unknown as BitrixClient

/** O que o Bitrix devolveu em staging (crmthinkers, chat 9500). */
const CANCELED = new Error(
  'Bitrix error: 400 - {"error":"CANCELED","error_description":"Você não pode enviar mensagens para o bate-papo especificado."}',
)

describe('notifyOperatorDailyLimitReached', () => {
  it('bot recusado no chat do canal aberto: posta como sistema pelo usuário do app', async () => {
    const callMethod = vi
      .fn()
      .mockRejectedValueOnce(CANCELED)
      .mockResolvedValueOnce({ result: 777 })

    const outcome = await notifyOperatorDailyLimitReached(
      clientWith(callMethod),
      1958,
      '9500',
    )

    expect(outcome).toEqual({
      posted: true,
      method: 'im.message.add',
      bitrixMessageId: '777',
    })
    expect(callMethod).toHaveBeenNthCalledWith(1, 'imbot.message.add', {
      BOT_ID: 1958,
      DIALOG_ID: 'chat9500',
      MESSAGE: DAILY_LIMIT_NOTICE,
      SYSTEM: 'Y',
    })
    expect(callMethod).toHaveBeenNthCalledWith(2, 'im.message.add', {
      DIALOG_ID: 'chat9500',
      MESSAGE: DAILY_LIMIT_NOTICE,
      SYSTEM: 'Y',
    })
  })

  it('recusa com HTTP 200 e erro no corpo também cai para o usuário do app', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValueOnce({ error: 'CANCELED', error_description: 'x' })
      .mockResolvedValueOnce({ result: 778 })

    const outcome = await notifyOperatorDailyLimitReached(
      clientWith(callMethod),
      1958,
      '9500',
    )

    expect(outcome).toMatchObject({ posted: true, method: 'im.message.add' })
  })

  it('todas as tentativas recusadas: não lança e devolve o motivo de cada uma', async () => {
    const callMethod = vi.fn().mockRejectedValue(CANCELED)

    const outcome = await notifyOperatorDailyLimitReached(
      clientWith(callMethod),
      1958,
      '9500',
    )

    expect(outcome.posted).toBe(false)
    if (!outcome.posted) {
      expect(outcome.reason).toContain('imbot.message.add')
      expect(outcome.reason).toContain('im.message.add')
      expect(outcome.reason).toContain('CANCELED')
    }
  })
})
