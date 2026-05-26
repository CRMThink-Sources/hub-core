import { Controller } from '@/shared/presentation/controller'
import { UpdateAllowedUserPermissionsController } from '../presentation/controllers/access/update-allowed-user-permissions.controller'
import { PrismaAllowedUserRepository } from '../infra/persistence/repositories/prisma-allowed-user.repository'

export const makeUpdateAllowedUserPermissionsController = (): Controller => {
  const repo = new PrismaAllowedUserRepository()
  return new UpdateAllowedUserPermissionsController(repo, repo)
}
