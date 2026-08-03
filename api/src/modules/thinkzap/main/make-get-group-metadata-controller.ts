import { Controller } from '@/shared/presentation/controller'
import { GetGroupMetadataService } from '../application/get-group-metadata.service'
import { GetGroupMetadataController } from '../presentation/controllers/get-group-metadata.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeGetGroupMetadataController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeGroupZApiDeps()

  const service = new GetGroupMetadataService(getAplicationContext, zApiClient)

  return new GetGroupMetadataController(service)
}
