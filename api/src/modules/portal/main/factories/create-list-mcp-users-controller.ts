import { Controller } from '@/shared/presentation/controller'
import { ListMcpUsers } from '../../application/list-mcp-users'
import { ListMcpUsersController } from '../../presentation/controllers/list-mcp-users-controller'
import { PrismaMcpUserRepository } from '../../infra/persistence/prisma-mcp-user.repository'

export const createListMcpUsersController = (): Controller => {
  const mcpUserRepository = new PrismaMcpUserRepository()
  const listMcpUsers = new ListMcpUsers(mcpUserRepository)

  return new ListMcpUsersController(listMcpUsers)
}
