import { Controller } from '@/shared/presentation/controller'
import { UnsubscribeThinkzapLineController } from '../../presentation/controllers/unsubscribe-thinkzap-line-controller'

export const createUnsubscribeThinkzapLineController = (): Controller => {
  return new UnsubscribeThinkzapLineController()
}
