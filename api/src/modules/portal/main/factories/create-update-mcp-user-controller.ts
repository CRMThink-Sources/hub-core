import { Controller } from '@/shared/presentation/controller'
import { UpdateMcpUser } from '../../application/update-mcp-user'
import { UpdateMcpUserController } from '../../presentation/controllers/update-mcp-user-controller'
import { PrismaMcpUserRepository } from '../../infra/persistence/prisma-mcp-user.repository'

export const createUpdateMcpUserController = (): Controller => {
  const mcpUserRepository = new PrismaMcpUserRepository()
  const updateMcpUser = new UpdateMcpUser(mcpUserRepository)

  return new UpdateMcpUserController(updateMcpUser)
}
