import { Controller } from '@/shared/presentation/controller'
import { UpdateAllowedDepartmentPermissionsController } from '../presentation/controllers/access/update-allowed-department-permissions.controller'
import { PrismaAllowedDepartmentRepository } from '../infra/persistence/repositories/prisma-allowed-department.repository'

export const makeUpdateAllowedDepartmentPermissionsController = (): Controller => {
  return new UpdateAllowedDepartmentPermissionsController(
    new PrismaAllowedDepartmentRepository(),
  )
}
