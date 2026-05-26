import { Controller } from '@/shared/presentation/controller'
import { AddAllowedDepartmentController } from '../presentation/controllers/access/add-allowed-department.controller'
import { PrismaAllowedDepartmentRepository } from '../infra/persistence/repositories/prisma-allowed-department.repository'

export const makeAddAllowedDepartmentController = (): Controller => {
  const repo = new PrismaAllowedDepartmentRepository()
  return new AddAllowedDepartmentController(repo, repo)
}
