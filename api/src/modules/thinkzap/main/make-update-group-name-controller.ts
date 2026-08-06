import { Controller } from '@/shared/presentation/controller'
import { UpdateGroupNameService } from '../application/update-group-name.service'
import { UpdateGroupNameController } from '../presentation/controllers/update-group-name.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeUpdateGroupNameController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeGroupZApiDeps()

  const service = new UpdateGroupNameService(getAplicationContext, zApiClient)

  return new UpdateGroupNameController(service)
}
