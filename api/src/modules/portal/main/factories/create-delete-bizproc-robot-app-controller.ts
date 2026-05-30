import { Controller } from '@/shared/presentation/controller'
import { DeleteBizprocRobotAppController } from '../../presentation/controllers/delete-bizproc-robot-app-controller'

export const createDeleteBizprocRobotAppController = (): Controller => {
  return new DeleteBizprocRobotAppController()
}
