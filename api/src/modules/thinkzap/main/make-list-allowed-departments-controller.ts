import { Controller } from '@/shared/presentation/controller'
import { ListAllowedDepartmentsController } from '../presentation/controllers/access/list-allowed-departments.controller'
import { PrismaAllowedDepartmentRepository } from '../infra/persistence/repositories/prisma-allowed-department.repository'

export const makeListAllowedDepartmentsController = (): Controller => {
  return new ListAllowedDepartmentsController(
    new PrismaAllowedDepartmentRepository(),
  )
}
