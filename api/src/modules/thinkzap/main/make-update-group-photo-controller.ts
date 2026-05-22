import { Controller } from '@/shared/presentation/controller'
import { UpdateGroupPhotoService } from '../application/update-group-photo.service'
import { UpdateGroupPhotoController } from '../presentation/controllers/update-group-photo.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeUpdateGroupPhotoController = async (): Promise<Controller> => {
  const { connectorRepository, instanceRepository, zApiClient } =
    makeGroupZApiDeps()

  const service = new UpdateGroupPhotoService(
    connectorRepository,
    instanceRepository,
    zApiClient,
  )

  return new UpdateGroupPhotoController(service)
}
