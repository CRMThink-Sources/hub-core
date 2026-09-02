import { Controller } from '@/shared/presentation/controller'
import { ListSmsProvidersAppController } from '../../presentation/controllers/list-sms-providers-app-controller'

export const createListSmsProvidersAppController = (): Controller => {
  return new ListSmsProvidersAppController()
}
