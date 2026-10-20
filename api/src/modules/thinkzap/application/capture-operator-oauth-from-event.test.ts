import { describe, expect, it, vi } from 'vitest'
import { captureOperatorOAuthFromEvent } from './capture-operator-oauth-from-event'
import type { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'

const baseAuth: IBX24MessageEvent['auth'] = {
  access_token: 'acc-27',
  refresh_token: 'ref-27',
  expires: '',
  expires_in: '3600',
  scope: 'imconnector,imopenlines',
  domain: 'acme.bitrix24.com',
  server_endpoint: '',
  status: 'P',
  client_endpoint: '',
  member_id: 'm1',
  user_id: '27',
  application_token: 'app-tok',
}

function makeUpsert() {
  return { execute: vi.fn().mockResolvedValue(undefined) }
}

describe('captureOperatorOAuthFromEvent', () => {
  it('grava o token quando o evento traz refresh e o auth é do autor', async () => {
    const upsert = makeUpsert()

    const outcome = await captureOperatorOAuthFromEvent(upsert, {
      appId: 'app-1',
      auth: baseAuth,
      messageUserId: 27,
    })

    expect(outcome).toEqual({ captured: true, bitrixUserId: '27' })
    expect(upsert.execute).toHaveBeenCalledWith({
      appId: 'app-1',
      bitrixUserId: '27',
      accessToken: 'acc-27',
      refreshToken: 'ref-27',
      expiresIn: 3600,
    })
  })

  it('ignora evento sem refresh_token', async () => {
    const upsert = makeUpsert()

    const outcome = await captureOperatorOAuthFromEvent(upsert, {
      appId: 'app-1',
      auth: { ...baseAuth, refresh_token: undefined },
      messageUserId: '27',
    })

    expect(outcome.captured).toBe(false)
    expect(upsert.execute).not.toHaveBeenCalled()
  })

  it('ignora quando o auth é de outro usuário', async () => {
    const upsert = makeUpsert()

    const outcome = await captureOperatorOAuthFromEvent(upsert, {
      appId: 'app-1',
      auth: { ...baseAuth, user_id: '1' },
      messageUserId: '27',
    })

    expect(outcome.captured).toBe(false)
    expect(upsert.execute).not.toHaveBeenCalled()
  })

  it('usa 1h quando expires_in vem vazio', async () => {
    const upsert = makeUpsert()

    await captureOperatorOAuthFromEvent(upsert, {
      appId: 'app-1',
      auth: { ...baseAuth, expires_in: '' },
      messageUserId: '27',
    })

    expect(upsert.execute).toHaveBeenCalledWith(
      expect.objectContaining({ expiresIn: 3600 }),
    )
  })

  it('falha ao gravar não lança', async () => {
    const upsert = {
      execute: vi.fn().mockRejectedValue(new Error('db down')),
    }

    const outcome = await captureOperatorOAuthFromEvent(upsert, {
      appId: 'app-1',
      auth: baseAuth,
      messageUserId: '27',
    })

    expect(outcome).toEqual({
      captured: false,
      reason: 'falha ao gravar: db down',
    })
  })
})
