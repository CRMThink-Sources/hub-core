import type { GenerateTokenRepository } from '@/shared/data/contracts/generate-token'
import type { PortalUserRepository } from '../domain/repositories/portal-user.repository'
import {
  InactivePortalUserError,
  InvalidCredentialsError,
} from '../domain/errors/portal-auth.errors'
import { verifyPassword } from './password.service'

export type LoginPortalUserInput = {
  email: string
  password: string
}

export type LoginPortalUserOutput = {
  token: string
}

export class LoginPortalUser {
  constructor(
    private readonly portalUserRepository: PortalUserRepository,
    private readonly generateToken: GenerateTokenRepository,
  ) {}

  async execute(input: LoginPortalUserInput): Promise<LoginPortalUserOutput> {
    const email = input.email.toLowerCase().trim()
    const user = await this.portalUserRepository.findByEmail(email)

    if (!user) {
      throw new InvalidCredentialsError()
    }

    const passwordMatches = await verifyPassword(
      input.password,
      user.passwordHash,
    )

    if (!passwordMatches) {
      throw new InvalidCredentialsError()
    }

    if (!user.isActive) {
      throw new InactivePortalUserError()
    }

    const { token } = this.generateToken.generateToken({
      type: 'portal',
      portalUserId: user.id,
      role: user.role,
    })

    return { token }
  }
}
