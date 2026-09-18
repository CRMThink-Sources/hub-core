import { Controller } from '@/shared/presentation/controller'
import { RegisterButtonImbotAppController } from '../../presentation/controllers/register-button-imbot-app-controller'

export const createRegisterButtonImbotAppController = (): Controller => {
  return new RegisterButtonImbotAppController()
}
