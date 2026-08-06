import { Controller } from '@/shared/presentation/controller'
import { UpdateGroupDescriptionService } from '../application/update-group-description.service'
import { UpdateGroupDescriptionController } from '../presentation/controllers/update-group-description.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeUpdateGroupDescriptionController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeGroupZApiDeps()

  const service = new UpdateGroupDescriptionService(
    getAplicationContext,
    zApiClient,
  )

  return new UpdateGroupDescriptionController(service)
}
