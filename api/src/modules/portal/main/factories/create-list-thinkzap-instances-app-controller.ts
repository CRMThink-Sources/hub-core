import { Controller } from '@/shared/presentation/controller'
import { ListThinkzapInstancesAppController } from '../../presentation/controllers/list-thinkzap-instances-app-controller'

export const createListThinkzapInstancesAppController = (): Controller => {
  return new ListThinkzapInstancesAppController()
}
