import type { RequestHandler } from 'express'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { Controller } from '@/shared/presentation/controller'
import { WidgetLineAccess } from '../application/access-group/widget-line-access'
import { PrismaAccessGroupRepository } from '../infra/persistence/repositories/prisma-access-group.repository'
import { departmentDirectory } from './make-department-directory'
import {
  CreateAccessGroupController,
  ListAccessGroupsController,
  RemoveAccessGroupController,
  UpdateAccessGroupController,
} from '../presentation/controllers/access-group/access-groups.controller'
import { ListPortalDepartmentsController } from '../presentation/controllers/access-group/list-portal-departments.controller'
import { GetMyLineAccessController } from '../presentation/controllers/access-group/get-my-line-access.controller'
import { makeWidgetLineAccessMiddleware } from '../presentation/middleware/widget-line-access.middleware'

const makeWidgetLineAccess = (): WidgetLineAccess =>
  new WidgetLineAccess(
    new PrismaInstalledAppRepository(),
    new PrismaAccessGroupRepository(),
    departmentDirectory,
  )

export const makeListAccessGroupsController = (): Controller =>
  new ListAccessGroupsController(new PrismaAccessGroupRepository())

export const makeCreateAccessGroupController = (): Controller =>
  new CreateAccessGroupController(new PrismaAccessGroupRepository())

export const makeUpdateAccessGroupController = (): Controller =>
  new UpdateAccessGroupController(new PrismaAccessGroupRepository())

export const makeRemoveAccessGroupController = (): Controller =>
  new RemoveAccessGroupController(new PrismaAccessGroupRepository())

export const makeListPortalDepartmentsController = (): Controller =>
  new ListPortalDepartmentsController(departmentDirectory)

export const makeGetMyLineAccessController = (): Controller =>
  new GetMyLineAccessController(makeWidgetLineAccess())

/** Guard dos grupos de acesso para as rotas do widget que recebem uma linha. */
export const makeWidgetLineGuard = (): RequestHandler =>
  makeWidgetLineAccessMiddleware(makeWidgetLineAccess())
