import { Controller } from '@/shared/presentation/controller'
import { LeaveGroupService } from '../application/leave-group.service'
import { LeaveGroupController } from '../presentation/controllers/leave-group.controller'
import { makeGroupZApiDeps } from './make-group-z-api-deps'

export const makeLeaveGroupController = (): Controller => {
  const { getAplicationContext, zApiClient } = makeGroupZApiDeps()

  const service = new LeaveGroupService(getAplicationContext, zApiClient)

  return new LeaveGroupController(service)
}
