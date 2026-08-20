import { Controller } from '@/shared/presentation/controller'
import { ListGroupsService } from '../application/list-groups.service'
import { ListGroupsController } from '../presentation/controllers/list-groups.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeListGroupsController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeGroupZApiDeps()

  const service = new ListGroupsService(getAplicationContext, zApiClient)

  return new ListGroupsController(service)
}
