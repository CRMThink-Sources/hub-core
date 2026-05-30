import { Controller } from '@/shared/presentation/controller'
import { RegisterBizprocRobotAppController } from '../../presentation/controllers/register-bizproc-robot-app-controller'

export const createRegisterBizprocRobotAppController = (): Controller => {
  return new RegisterBizprocRobotAppController()
}
