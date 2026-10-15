import { describe, expect, it, vi } from 'vitest'
import type IORedis from 'ioredis'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { BitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import {
  ensureBitrixBotId,
  invalidateBitrixBotId,
  isBotNotFoundError,
} from './ensure-bitrix-bot-id'

const KEY = 'thinkzap:bot:portal.bitrix24.com.br:crmthink.thinkzap'

function makeRedis(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: vi.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: vi.fn((k: string, v: string) => {
      store.set(k, v)
      return Promise.resolve('OK')
    }),
    del: vi.fn((k: string) => Promise.resolve(store.delete(k) ? 1 : 0)),
  }
}

describe('isBotNotFoundError', () => {
  it('reconhece o código embutido na mensagem do BitrixClient', () => {
    const error = new BitrixError(
      'Bitrix error: 400 - {"error":"BOT_NOT_FOUND","error_description":"Bot not found"}',
    )

    expect(isBotNotFoundError(error)).toBe(true)
  })

  it('reconhece pelo código mesmo com a descrição traduzida', () => {
    const error = new BitrixApiError(
      'imbot.v2.Chat.Message.get',
      'BOT_NOT_FOUND',
      'Bot não encontrado',
      'Bitrix imbot.v2.Chat.Message.get: Bot não encontrado',
    )

    expect(isBotNotFoundError(error)).toBe(true)
  })

  it('não classifica outro erro do Bitrix', () => {
    expect(
      isBotNotFoundError(
        new BitrixError('Bitrix error: 400 - {"error":"ACCESS_DENIED"}'),
      ),
    ).toBe(false)
    expect(isBotNotFoundError('BOT_NOT_FOUND')).toBe(false)
  })
})

describe('invalidateBitrixBotId', () => {
  it('faz o próximo ensureBitrixBotId resolver no Bitrix e regravar o cache', async () => {
    const redis = makeRedis({ [KEY]: '22' })
    const callMethod = vi.fn().mockResolvedValue({
      result: { bots: [{ id: 1958, code: 'thinkzap-connector' }] },
    })
    const client = { callMethod } as unknown as BitrixClient
    const args = [
      client,
      redis as unknown as IORedis,
      'portal.bitrix24.com.br',
      'crmthink.thinkzap',
    ] as const

    expect(await ensureBitrixBotId(...args)).toBe(22)
    expect(callMethod).not.toHaveBeenCalled()

    await invalidateBitrixBotId(
      redis as unknown as IORedis,
      'portal.bitrix24.com.br',
      'crmthink.thinkzap',
    )

    expect(await ensureBitrixBotId(...args)).toBe(1958)
    expect(callMethod).toHaveBeenCalledWith('imbot.v2.Bot.list', {})
    expect(redis.store.get(KEY)).toBe('1958')
  })

  it('falha do Redis não derruba quem chamou', async () => {
    const redis = makeRedis()
    redis.del.mockRejectedValue(new Error('ECONNRESET'))

    await expect(
      invalidateBitrixBotId(
        redis as unknown as IORedis,
        'portal.bitrix24.com.br',
        'crmthink.thinkzap',
      ),
    ).resolves.toBeUndefined()
  })
})
