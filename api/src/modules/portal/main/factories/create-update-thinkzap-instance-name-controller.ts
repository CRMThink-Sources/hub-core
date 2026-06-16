import { Controller } from '@/shared/presentation/controller'
import { UpdateThinkzapInstanceNameController } from '../../presentation/controllers/update-thinkzap-instance-name-controller'

export const createUpdateThinkzapInstanceNameController = (): Controller => {
  return new UpdateThinkzapInstanceNameController()
}
