import { Controller } from '@/shared/presentation/controller'
import { DeleteSmsProviderByCodeAppController } from '../../presentation/controllers/delete-sms-provider-by-code-app-controller'

export const createDeleteSmsProviderByCodeAppController = (): Controller => {
  return new DeleteSmsProviderByCodeAppController()
}
