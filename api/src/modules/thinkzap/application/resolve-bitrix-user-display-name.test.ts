import { describe, expect, it, vi } from 'vitest'
import { resolveBitrixUserDisplayName } from './resolve-bitrix-user-display-name'
import { GetBitrixUserDisplayNamePort } from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'
import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'

const allowedUserWith = (displayName: string | null) =>
  ({
    getByAppIdAndBitrixUserId: vi.fn().mockResolvedValue({ displayName }),
  }) as unknown as GetAllowedUserRepository

describe('resolveBitrixUserDisplayName', () => {
  it('returns display name from Bitrix when available', async () => {
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName: vi.fn().mockResolvedValue({ name: 'João Silva' }),
    }

    const result = await resolveBitrixUserDisplayName({
      userId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName,
    })

    expect(result).toEqual({ name: 'João Silva' })
  })

  it('falls back to allowed user display name when Bitrix returns null', async () => {
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName: vi.fn().mockResolvedValue({ name: null }),
    }

    const result = await resolveBitrixUserDisplayName({
      userId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName,
      getAllowedUser: allowedUserWith('Maria Souza'),
    })

    expect(result).toEqual({ name: 'Maria Souza' })
  })

  it('keeps the Bitrix refusal as the failure even when the record is empty', async () => {
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName: vi.fn().mockResolvedValue({
        name: null,
        refusal: 'Bitrix error: 400 - {"error":"insufficient_scope"}',
      }),
    }

    const result = await resolveBitrixUserDisplayName({
      userId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName,
      getAllowedUser: allowedUserWith(null),
    })

    expect(result).toEqual({
      name: null,
      failure: 'bitrix-refused',
      refusal: 'Bitrix error: 400 - {"error":"insufficient_scope"}',
    })
  })

  it('reports the empty record when Bitrix answered without a name', async () => {
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName: vi.fn().mockResolvedValue({ name: null }),
    }

    const result = await resolveBitrixUserDisplayName({
      userId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName,
      getAllowedUser: allowedUserWith('   '),
    })

    expect(result).toEqual({ name: null, failure: 'allowed-user-empty' })
  })

  it('reports the Bitrix outcome when there is no record repository', async () => {
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName: vi.fn().mockResolvedValue({ name: null }),
    }

    const result = await resolveBitrixUserDisplayName({
      userId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName,
    })

    expect(result).toEqual({ name: null, failure: 'bitrix-empty' })
  })

  it('returns no-user-id when user id is empty', async () => {
    const getDisplayName = vi.fn()
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName,
    }

    const result = await resolveBitrixUserDisplayName({
      userId: '',
      appId: 'app-1',
      getBitrixUserDisplayName,
    })

    expect(result).toEqual({ name: null, failure: 'no-user-id' })
    expect(getDisplayName).not.toHaveBeenCalled()
  })
})
