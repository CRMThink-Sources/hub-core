import { Controller } from '@/shared/presentation/controller'
import { GetThinkzapPricingController } from '../presentation/controllers/get-thinkzap-pricing.controller'

export const makeGetThinkzapPricingController = (): Controller => {
  return new GetThinkzapPricingController()
}
