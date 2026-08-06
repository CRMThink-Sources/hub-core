import { Controller } from '@/shared/presentation/controller'
import { CreateGroupService } from '../application/create-group.service'
import { CreateGroupController } from '../presentation/controllers/create-group.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeCreateGroupController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeGroupZApiDeps()

  const createGroupService = new CreateGroupService(
    getAplicationContext,
    zApiClient,
  )

  return new CreateGroupController(createGroupService)
}
