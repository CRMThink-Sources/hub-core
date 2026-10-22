import { Controller } from '@/shared/presentation/controller'
import { RegisterConnectorAppController } from '../../presentation/controllers/register-connector-app-controller'

export const createRegisterConnectorAppController = (): Controller => {
  return new RegisterConnectorAppController()
}
