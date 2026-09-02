import { Controller } from '@/shared/presentation/controller'
import { DeleteSmsProviderAppController } from '../../presentation/controllers/delete-sms-provider-app-controller'

export const createDeleteSmsProviderAppController = (): Controller => {
  return new DeleteSmsProviderAppController()
}
