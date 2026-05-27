import { describe, expect, it, vi } from 'vitest'
import { resolveBitrixUserDisplayName } from './resolve-bitrix-user-display-name'
import { GetBitrixUserDisplayNamePort } from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'
import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'

describe('resolveBitrixUserDisplayName', () => {
  it('returns display name from Bitrix when available', async () => {
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName: vi.fn().mockResolvedValue('João Silva'),
    }

    const result = await resolveBitrixUserDisplayName({
      userId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName,
    })

    expect(result).toBe('João Silva')
  })

  it('falls back to allowed user display name when Bitrix returns null', async () => {
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName: vi.fn().mockResolvedValue(null),
    }

    const getAllowedUser: GetAllowedUserRepository = {
      getByAppIdAndBitrixUserId: vi.fn().mockResolvedValue({
        displayName: 'Maria Souza',
      }),
    } as unknown as GetAllowedUserRepository

    const result = await resolveBitrixUserDisplayName({
      userId: '42',
      appId: 'app-1',
      getBitrixUserDisplayName,
      getAllowedUser,
    })

    expect(result).toBe('Maria Souza')
  })

  it('returns null when user id is empty', async () => {
    const getDisplayName = vi.fn()
    const getBitrixUserDisplayName: GetBitrixUserDisplayNamePort = {
      getDisplayName,
    }

    const result = await resolveBitrixUserDisplayName({
      userId: '',
      appId: 'app-1',
      getBitrixUserDisplayName,
    })

    expect(result).toBeNull()
    expect(getDisplayName).not.toHaveBeenCalled()
  })
})
