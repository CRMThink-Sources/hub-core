import type { PortalSession } from '../domain/entities/portal-user'
import type { PortalUserRepository } from '../domain/repositories/portal-user.repository'
import { PortalUserNotFoundError } from '../domain/errors/portal-auth.errors'

export class GetPortalSession {
  constructor(private readonly portalUserRepository: PortalUserRepository) {}

  async execute(portalUserId: string): Promise<PortalSession> {
    const user = await this.portalUserRepository.findById(portalUserId)

    if (!user || !user.isActive) {
      throw new PortalUserNotFoundError()
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }
  }
}
