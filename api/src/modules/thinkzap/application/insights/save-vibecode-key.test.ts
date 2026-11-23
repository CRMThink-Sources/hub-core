import { describe, expect, it, vi } from 'vitest'

// O env é lido na importação do cipher; a chave precisa existir antes disso.
vi.hoisted(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
})

import type { InsightsSettingsRepository } from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'
import { VibecodeKeyRejectedError } from '@/modules/thinkzap/domain/errors/vibecode-key-rejected.error'
import type { VibecodeMe } from '@/modules/thinkzap/domain/vibecode-key-policy'
import { decryptToken } from '@/shared/infra/crypto/token-cipher'
import { SaveVibecodeKey } from './save-vibecode-key'
import { getKeyProblem, markKeyRevoked } from './key-health'

const validMe: VibecodeMe = {
  type: 'personal',
  portal: 'acme.bitrix24.com.br',
  portalId: '123',
  scopes: ['crm', 'imopenlines', 'im', 'user', 'department'],
  accessMode: 'READONLY',
}

function setup(me: () => Promise<VibecodeMe> = () => Promise.resolve(validMe)) {
  const saveKey = vi
    .fn<InsightsSettingsRepository['saveKey']>()
    .mockResolvedValue()
  const settings = { saveKey } as unknown as InsightsSettingsRepository
  const makeClient = vi.fn((_key: string) => ({ me }))
  const getPortalDomain = vi.fn((_appId: string) =>
    Promise.resolve('acme.bitrix24.com.br'),
  )
  const now = new Date('2026-11-18T10:00:00Z')
  const useCase = new SaveVibecodeKey({
    settings,
    makeClient,
    getPortalDomain,
    now: () => now,
  })
  return { useCase, saveKey, makeClient, now }
}

describe('SaveVibecodeKey', () => {
  it('salva chave válida cifrada e devolve last4', async () => {
    const { useCase, saveKey, now } = setup()
    await markKeyRevoked('app-1')

    const result = await useCase.execute('app-1', 'vibe_abcdWXYZ')

    expect(result).toEqual({ last4: 'WXYZ' })
    const saved = saveKey.mock.calls[0]![1]
    expect(saved.keyEnc.startsWith('v1:')).toBe(true)
    expect(saved.keyEnc).not.toBe('vibe_abcdWXYZ')
    expect(decryptToken(saved.keyEnc)).toBe('vibe_abcdWXYZ')
    expect(saved.portalId).toBe('123')
    expect(saved.validatedAt).toEqual(now)
    expect(await getKeyProblem('app-1')).toBeNull()
  })

  it('recusa escopo extra e não persiste nada', async () => {
    const { useCase, saveKey } = setup(() =>
      Promise.resolve({
        ...validMe,
        scopes: [...validMe.scopes, 'task'],
      }),
    )

    await expect(useCase.execute('app-1', 'chave')).rejects.toBeInstanceOf(
      VibecodeKeyRejectedError,
    )
    expect(saveKey).not.toHaveBeenCalled()
  })

  it('faz trim na chave com espaços, quebra de linha e aspas', async () => {
    const { useCase, saveKey, makeClient } = setup()

    await useCase.execute('app-1', '  "vibe_key1234"\r\n')

    expect(makeClient).toHaveBeenCalledWith('vibe_key1234')
    expect(decryptToken(saveKey.mock.calls[0]![1].keyEnc)).toBe('vibe_key1234')
  })

  it('exige chave não vazia', async () => {
    const { useCase, makeClient } = setup()
    await expect(useCase.execute('app-1', '  \n')).rejects.toThrow(
      'Informe a chave Vibecode.',
    )
    expect(makeClient).not.toHaveBeenCalled()
  })

  it('lança erro sem a chave no texto quando o /me falha', async () => {
    const { useCase, saveKey } = setup(() => {
      return Promise.reject(new Error('Falha de rede'))
    })

    const err = await useCase
      .execute('app-1', 'segredo-xyz')
      .catch((e: unknown) => e as Error)

    expect(err).toBeInstanceOf(Error)
    expect(String((err as Error).message)).not.toContain('segredo-xyz')
    expect(saveKey).not.toHaveBeenCalled()
  })
})
