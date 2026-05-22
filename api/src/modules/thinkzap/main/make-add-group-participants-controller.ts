import { Controller } from '@/shared/presentation/controller'
import { AddGroupParticipantsService } from '../application/add-group-participants.service'
import { AddGroupParticipantsController } from '../presentation/controllers/add-group-participants.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeAddGroupParticipantsController = (): Controller => {
  const { connectorRepository, instanceRepository, zApiClient } =
    makeGroupZApiDeps()

  const service = new AddGroupParticipantsService(
    connectorRepository,
    instanceRepository,
    zApiClient,
  )

  return new AddGroupParticipantsController(service)
}
