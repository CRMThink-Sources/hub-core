import { Controller } from '@/shared/presentation/controller'
import { UpdatePortalUserBitrixId } from '../../application/update-portal-user-bitrix-id'
import { UpdatePortalUserBitrixIdController } from '../../presentation/controllers/update-portal-user-bitrix-id-controller'
import { PrismaPortalUserRepository } from '../../infra/persistence/prisma-portal-user.repository'

export const createUpdatePortalUserBitrixIdController = (): Controller => {
  const portalUserRepository = new PrismaPortalUserRepository()
  const updatePortalUserBitrixId = new UpdatePortalUserBitrixId(
    portalUserRepository,
  )

  return new UpdatePortalUserBitrixIdController(updatePortalUserBitrixId)
}
