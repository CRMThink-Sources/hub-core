import { Controller } from '@/shared/presentation/controller'
import { DeleteSpaWidgetAppController } from '../../presentation/controllers/delete-spa-widget-app-controller'

export const createDeleteSpaWidgetAppController = (): Controller => {
  return new DeleteSpaWidgetAppController()
}
