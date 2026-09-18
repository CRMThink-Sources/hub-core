import { Controller } from '@/shared/presentation/controller'
import { DeleteButtonImbotAppController } from '../../presentation/controllers/delete-button-imbot-app-controller'

export const createDeleteButtonImbotAppController = (): Controller => {
  return new DeleteButtonImbotAppController()
}
