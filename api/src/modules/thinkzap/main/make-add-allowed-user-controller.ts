import { Controller } from '@/shared/presentation/controller'
import { AddAllowedUserController } from '../presentation/controllers/access/add-allowed-user.controller'
import { PrismaAllowedUserRepository } from '../infra/persistence/repositories/prisma-allowed-user.repository'

export const makeAddAllowedUserController = (): Controller => {
  const repo = new PrismaAllowedUserRepository()
  return new AddAllowedUserController(repo, repo)
}
