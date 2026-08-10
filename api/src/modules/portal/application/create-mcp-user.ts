import type { McpUserRepository } from '../domain/repositories/mcp-user.repository'
import {
  McpDomainNotFoundError,
  McpUserAlreadyExistsError,
} from '../domain/errors/mcp-user.errors'
import { hashPassword } from './password.service'

export type CreateMcpUserInput = {
  email: string
  name: string
  password: string
  domainId: string
  isAdmin: boolean
}

export type CreateMcpUserOutput = {
  id: string
  email: string
  name: string
  domainId: string
  isAdmin: boolean
}

export class CreateMcpUser {
  constructor(private readonly mcpUserRepository: McpUserRepository) {}

  async execute(input: CreateMcpUserInput): Promise<CreateMcpUserOutput> {
    const email = input.email.toLowerCase().trim()

    const domainExists = await this.mcpUserRepository.domainExists(
      input.domainId,
    )
    if (!domainExists) {
      throw new McpDomainNotFoundError()
    }

    const existing = await this.mcpUserRepository.findByEmail(email)
    if (existing) {
      throw new McpUserAlreadyExistsError()
    }

    const passwordHash = await hashPassword(input.password)

    const user = await this.mcpUserRepository.create({
      email,
      name: input.name.trim(),
      passwordHash,
      domainId: input.domainId,
      isAdmin: input.isAdmin,
      isActive: true,
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      domainId: user.domainId,
      isAdmin: user.isAdmin,
    }
  }
}
