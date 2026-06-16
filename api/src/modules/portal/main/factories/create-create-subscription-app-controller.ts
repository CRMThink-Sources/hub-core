import { Controller } from '@/shared/presentation/controller'
import { CreateSubscriptionAppController } from '../../presentation/controllers/create-subscription-app-controller'

export const createCreateSubscriptionAppController = (): Controller => {
  return new CreateSubscriptionAppController()
}
