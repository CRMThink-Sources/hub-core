import { Controller } from '@/shared/presentation/controller'
import { CancelSubscriptionTrialController } from '../../presentation/controllers/cancel-subscription-trial-controller'

export const createCancelSubscriptionTrialController = (): Controller => {
  return new CancelSubscriptionTrialController()
}
