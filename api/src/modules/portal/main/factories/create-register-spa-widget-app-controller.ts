import { Controller } from '@/shared/presentation/controller'
import { RegisterSpaWidgetAppController } from '../../presentation/controllers/register-spa-widget-app-controller'

export const createRegisterSpaWidgetAppController = (): Controller => {
  return new RegisterSpaWidgetAppController()
}
