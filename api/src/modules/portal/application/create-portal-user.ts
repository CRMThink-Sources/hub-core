import type { PortalUserRepository } from '../domain/repositories/portal-user.repository'
import { PortalUserAlreadyExistsError } from '../domain/errors/portal-auth.errors'
import { hashPassword } from './password.service'

export type CreatePortalUserInput = {
  email: string
  name: string
  password: string
}

export type CreatePortalUserOutput = {
  id: string
  email: string
  name: string
  role: string
}

export class CreatePortalUser {
  constructor(private readonly portalUserRepository: PortalUserRepository) {}

  async execute(input: CreatePortalUserInput): Promise<CreatePortalUserOutput> {
    const email = input.email.toLowerCase().trim()

    const existing = await this.portalUserRepository.findByEmail(email)
    if (existing) {
      throw new PortalUserAlreadyExistsError()
    }

    const passwordHash = await hashPassword(input.password)

    const user = await this.portalUserRepository.create({
      email,
      name: input.name.trim(),
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }
  }
}
