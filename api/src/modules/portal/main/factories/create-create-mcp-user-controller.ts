import { Controller } from '@/shared/presentation/controller'
import { CreateMcpUser } from '../../application/create-mcp-user'
import { CreateMcpUserController } from '../../presentation/controllers/create-mcp-user-controller'
import { PrismaMcpUserRepository } from '../../infra/persistence/prisma-mcp-user.repository'

export const createCreateMcpUserController = (): Controller => {
  const mcpUserRepository = new PrismaMcpUserRepository()
  const createMcpUser = new CreateMcpUser(mcpUserRepository)

  return new CreateMcpUserController(createMcpUser)
}
