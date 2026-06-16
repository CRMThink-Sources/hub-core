import { Controller } from '@/shared/presentation/controller'
import { ListSubscriptionsAppController } from '../../presentation/controllers/list-subscriptions-app-controller'

export const createListSubscriptionsAppController = (): Controller => {
  return new ListSubscriptionsAppController()
}
