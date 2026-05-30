import { Controller } from '@/shared/presentation/controller'
import { ListBizprocRobotsAppController } from '../../presentation/controllers/list-bizproc-robots-app-controller'

export const createListBizprocRobotsAppController = (): Controller => {
  return new ListBizprocRobotsAppController()
}
