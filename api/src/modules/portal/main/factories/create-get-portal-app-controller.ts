import { Controller } from '@/shared/presentation/controller'
import { GetPortalAppDetail } from '../../application/get-portal-app-detail'
import { PrismaPortalAppReadRepository } from '../../infra/persistence/prisma-portal-app-read.repository'
import { GetPortalAppController } from '../../presentation/controllers/get-portal-app-controller'
import { makeAplicationTitleReader } from '../make-portal-hydration'

export const createGetPortalAppController = (): Controller =>
  new GetPortalAppController(
    new GetPortalAppDetail(
      new PrismaPortalAppReadRepository(),
      makeAplicationTitleReader(),
    ),
  )
