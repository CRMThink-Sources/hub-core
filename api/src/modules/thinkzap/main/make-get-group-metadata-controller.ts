import { Controller } from '@/shared/presentation/controller'
import { GetGroupMetadataService } from '../application/get-group-metadata.service'
import { GetGroupMetadataController } from '../presentation/controllers/get-group-metadata.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeGetGroupMetadataController = (): Controller => {
  const { connectorRepository, instanceRepository, zApiClient } =
    makeGroupZApiDeps()

  const service = new GetGroupMetadataService(
    connectorRepository,
    instanceRepository,
    zApiClient,
  )

  return new GetGroupMetadataController(service)
}
