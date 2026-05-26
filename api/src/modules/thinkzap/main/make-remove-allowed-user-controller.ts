import { Controller } from '@/shared/presentation/controller'
import { RemoveAllowedUserController } from '../presentation/controllers/access/remove-allowed-user.controller'
import { PrismaAllowedUserRepository } from '../infra/persistence/repositories/prisma-allowed-user.repository'

export const makeRemoveAllowedUserController = (): Controller => {
  return new RemoveAllowedUserController(new PrismaAllowedUserRepository())
}
