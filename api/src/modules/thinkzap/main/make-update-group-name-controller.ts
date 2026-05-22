import { Controller } from '@/shared/presentation/controller'
import { UpdateGroupNameService } from '../application/update-group-name.service'
import { UpdateGroupNameController } from '../presentation/controllers/update-group-name.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeUpdateGroupNameController = (): Controller => {
  const { connectorRepository, instanceRepository, zApiClient } =
    makeGroupZApiDeps()

  const service = new UpdateGroupNameService(
    connectorRepository,
    instanceRepository,
    zApiClient,
  )

  return new UpdateGroupNameController(service)
}
