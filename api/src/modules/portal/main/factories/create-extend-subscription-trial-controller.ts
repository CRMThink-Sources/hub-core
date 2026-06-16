import { Controller } from '@/shared/presentation/controller'
import { ExtendSubscriptionTrialController } from '../../presentation/controllers/extend-subscription-trial-controller'

export const createExtendSubscriptionTrialController = (): Controller => {
  return new ExtendSubscriptionTrialController()
}
