import { Controller } from '@/shared/presentation/controller'
import { ListThinkzapConnectorsAppController } from '../../presentation/controllers/list-thinkzap-connectors-app-controller'

export const createListThinkzapConnectorsAppController = (): Controller => {
  return new ListThinkzapConnectorsAppController()
}
