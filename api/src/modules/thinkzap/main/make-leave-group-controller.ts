import { Controller } from '@/shared/presentation/controller'
import { LeaveGroupService } from '../application/leave-group.service'
import { LeaveGroupController } from '../presentation/controllers/leave-group.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeLeaveGroupController = async (): Promise<Controller> => {
  const { connectorRepository, instanceRepository, zApiClient } =
    makeGroupZApiDeps()

  const service = new LeaveGroupService(
    connectorRepository,
    instanceRepository,
    zApiClient,
  )

  return new LeaveGroupController(service)
}
