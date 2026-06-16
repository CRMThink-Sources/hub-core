import { Controller } from '@/shared/presentation/controller'
import { UnsubscribeThinkzapInstanceController } from '../../presentation/controllers/unsubscribe-thinkzap-instance-controller'

export const createUnsubscribeThinkzapInstanceController = (): Controller => {
  return new UnsubscribeThinkzapInstanceController()
}
