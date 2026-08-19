import { Controller } from '@/shared/presentation/controller'
import { UpdateThinkzapLineNameController } from '../../presentation/controllers/update-thinkzap-line-name-controller'

export const createUpdateThinkzapLineNameController = (): Controller => {
  return new UpdateThinkzapLineNameController()
}
