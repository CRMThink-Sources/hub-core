import type { McpUserRepository } from '../domain/repositories/mcp-user.repository'
import {
  McpDomainNotFoundError,
  McpUserNotFoundError,
} from '../domain/errors/mcp-user.errors'
import { hashPassword } from './password.service'

export type UpdateMcpUserInput = {
  id: string
  name?: string
  domainId?: string
  isAdmin?: boolean
  isActive?: boolean
  password?: string
}

export type UpdateMcpUserOutput = {
  id: string
  email: string
  name: string
  domainId: string
  isAdmin: boolean
  isActive: boolean
}

export class UpdateMcpUser {
  constructor(private readonly mcpUserRepository: McpUserRepository) {}

  async execute(input: UpdateMcpUserInput): Promise<UpdateMcpUserOutput> {
    const existing = await this.mcpUserRepository.findById(input.id)
    if (!existing) {
      throw new McpUserNotFoundError()
    }

    if (input.domainId) {
      const domainExists = await this.mcpUserRepository.domainExists(
        input.domainId,
      )
      if (!domainExists) {
        throw new McpDomainNotFoundError()
      }
    }

    const passwordHash = input.password
      ? await hashPassword(input.password)
      : undefined

    const user = await this.mcpUserRepository.update(input.id, {
      name: input.name?.trim(),
      domainId: input.domainId,
      isAdmin: input.isAdmin,
      isActive: input.isActive,
      passwordHash,
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      domainId: user.domainId,
      isAdmin: user.isAdmin,
      isActive: user.isActive,
    }
  }
}
