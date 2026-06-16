import { Controller } from '@/shared/presentation/controller'
import { CreateTrialSubscriptionAppController } from '../../presentation/controllers/create-trial-subscription-app-controller'

export const createCreateTrialSubscriptionAppController = (): Controller => {
  return new CreateTrialSubscriptionAppController()
}
