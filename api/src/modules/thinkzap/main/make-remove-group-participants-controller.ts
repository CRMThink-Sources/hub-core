import { Controller } from '@/shared/presentation/controller'
import { RemoveGroupParticipantsService } from '../application/remove-group-participants.service'
import { RemoveGroupParticipantsController } from '../presentation/controllers/remove-group-participants.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeRemoveGroupParticipantsController =
  async (): Promise<Controller> => {
    const { connectorRepository, instanceRepository, zApiClient } =
      makeGroupZApiDeps()

    const service = new RemoveGroupParticipantsService(
      connectorRepository,
      instanceRepository,
      zApiClient,
    )

    return new RemoveGroupParticipantsController(service)
  }
