import { Controller } from '@/shared/presentation/controller'
import { CreateSubscriptionCheckoutController } from '../presentation/controllers/create-subscription-checkout.controller'

export const makeCreateSubscriptionCheckoutController = (): Controller => {
  return new CreateSubscriptionCheckoutController()
}
