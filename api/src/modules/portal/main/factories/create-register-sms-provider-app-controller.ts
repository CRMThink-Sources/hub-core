import { Controller } from '@/shared/presentation/controller'
import { RegisterSmsProviderAppController } from '../../presentation/controllers/register-sms-provider-app-controller'

export const createRegisterSmsProviderAppController = (): Controller => {
  return new RegisterSmsProviderAppController()
}
