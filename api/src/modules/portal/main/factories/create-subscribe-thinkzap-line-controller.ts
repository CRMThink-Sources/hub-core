import { Controller } from '@/shared/presentation/controller'
import { SubscribeThinkzapLineController } from '../../presentation/controllers/subscribe-thinkzap-line-controller'

export const createSubscribeThinkzapLineController = (): Controller => {
  return new SubscribeThinkzapLineController()
}
