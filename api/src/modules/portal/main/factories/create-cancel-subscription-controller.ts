import { Controller } from '@/shared/presentation/controller'
import { CancelSubscriptionController } from '../../presentation/controllers/cancel-subscription-controller'

export const createCancelSubscriptionController = (): Controller => {
  return new CancelSubscriptionController()
}
