import { Controller } from '@/shared/presentation/controller'
import { ListAppSubscriptionsController } from '../../presentation/controllers/list-app-subscriptions-controller'

export const createListAppSubscriptionsController = (): Controller => {
  return new ListAppSubscriptionsController()
}
