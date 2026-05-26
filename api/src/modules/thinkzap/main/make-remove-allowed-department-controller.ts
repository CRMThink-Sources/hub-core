import { Controller } from '@/shared/presentation/controller'
import { RemoveAllowedDepartmentController } from '../presentation/controllers/access/remove-allowed-department.controller'
import { PrismaAllowedDepartmentRepository } from '../infra/persistence/repositories/prisma-allowed-department.repository'

export const makeRemoveAllowedDepartmentController = (): Controller => {
  return new RemoveAllowedDepartmentController(
    new PrismaAllowedDepartmentRepository(),
  )
}
