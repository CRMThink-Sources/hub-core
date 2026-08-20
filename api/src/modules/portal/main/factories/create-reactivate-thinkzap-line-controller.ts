import { Controller } from '@/shared/presentation/controller'
import { ReactivateThinkzapLineController } from '../../presentation/controllers/reactivate-thinkzap-line-controller'

export const createReactivateThinkzapLineController = (): Controller => {
  return new ReactivateThinkzapLineController()
}
