import { Controller } from '@/shared/presentation/controller'
import { SubscribeThinkzapInstanceController } from '../../presentation/controllers/subscribe-thinkzap-instance-controller'

export const createSubscribeThinkzapInstanceController = (): Controller => {
  return new SubscribeThinkzapInstanceController()
}
