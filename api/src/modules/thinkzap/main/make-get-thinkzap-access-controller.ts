import { Controller } from '@/shared/presentation/controller'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { GetThinkzapAccessController } from '../presentation/controllers/access/get-thinkzap-access.controller'
import { PrismaAllowedUserRepository } from '../infra/persistence/repositories/prisma-allowed-user.repository'
import { PrismaAllowedDepartmentRepository } from '../infra/persistence/repositories/prisma-allowed-department.repository'

export const makeGetThinkzapAccessController = (): Controller => {
  return new GetThinkzapAccessController(
    new PrismaInstalledAppRepository(),
    new PrismaAllowedUserRepository(),
    new PrismaAllowedDepartmentRepository(),
  )
}
