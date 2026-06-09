import { Controller } from '@/shared/presentation/controller'
import { UpdateThinkzapConnectorEventBindsAppController } from '../../presentation/controllers/update-thinkzap-connector-event-binds-app-controller'

export const createUpdateThinkzapConnectorEventBindsAppController =
  (): Controller => {
    return new UpdateThinkzapConnectorEventBindsAppController()
  }
