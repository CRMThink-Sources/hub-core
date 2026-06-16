import { Controller } from '@/shared/presentation/controller'
import { ReactivateThinkzapConnectorController } from '../../presentation/controllers/reactivate-thinkzap-connector-controller'

export const createReactivateThinkzapConnectorController = (): Controller => {
  return new ReactivateThinkzapConnectorController()
}
