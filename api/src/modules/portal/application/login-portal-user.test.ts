import { describe, expect, it, vi } from 'vitest'
import { LoginPortalUser } from './login-portal-user'
import type { PortalUserRepository } from '../domain/repositories/portal-user.repository'
import type { GenerateTokenRepository } from '@/shared/data/contracts/generate-token'
import {
  InactivePortalUserError,
  InvalidCredentialsError,
} from '../domain/errors/portal-auth.errors'
import { hashPassword } from './password.service'

const activeUser = {
  id: 'user-1',
  email: 'admin@hubthink.com',
  name: 'Admin',
  passwordHash: '',
  role: 'ADMIN' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('LoginPortalUser', () => {
  it('returns token for valid credentials', async () => {
    activeUser.passwordHash = await hashPassword('secret123')

    const portalUserRepository: PortalUserRepository = {
      findByEmail: vi.fn().mockResolvedValue(activeUser),
      findById: vi.fn(),
    }

    const generateTokenSpy = vi.fn().mockReturnValue({ token: 'jwt-token' })
    const generateToken: GenerateTokenRepository = {
      generateToken: generateTokenSpy,
    }

    const useCase = new LoginPortalUser(portalUserRepository, generateToken)
    const result = await useCase.execute({
      email: 'admin@hubthink.com',
      password: 'secret123',
    })

    expect(result.token).toBe('jwt-token')
    expect(generateTokenSpy).toHaveBeenCalledWith({
      type: 'portal',
      portalUserId: 'user-1',
      role: 'ADMIN',
    })
  })

  it('throws for unknown email', async () => {
    const portalUserRepository: PortalUserRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
    }

    const generateToken: GenerateTokenRepository = {
      generateToken: vi.fn(),
    }

    const useCase = new LoginPortalUser(portalUserRepository, generateToken)

    await expect(
      useCase.execute({ email: 'missing@hubthink.com', password: 'secret' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('throws for wrong password', async () => {
    activeUser.passwordHash = await hashPassword('secret123')

    const portalUserRepository: PortalUserRepository = {
      findByEmail: vi.fn().mockResolvedValue(activeUser),
      findById: vi.fn(),
    }

    const generateToken: GenerateTokenRepository = {
      generateToken: vi.fn(),
    }

    const useCase = new LoginPortalUser(portalUserRepository, generateToken)

    await expect(
      useCase.execute({ email: 'admin@hubthink.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError)
  })

  it('throws for inactive user', async () => {
    activeUser.passwordHash = await hashPassword('secret123')

    const portalUserRepository: PortalUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        ...activeUser,
        isActive: false,
      }),
      findById: vi.fn(),
    }

    const generateToken: GenerateTokenRepository = {
      generateToken: vi.fn(),
    }

    const useCase = new LoginPortalUser(portalUserRepository, generateToken)

    await expect(
      useCase.execute({ email: 'admin@hubthink.com', password: 'secret123' }),
    ).rejects.toBeInstanceOf(InactivePortalUserError)
  })
})
