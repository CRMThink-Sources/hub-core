import { Controller } from '@/shared/presentation/controller'
import { RegisterConversationWidgetAppController } from '../../presentation/controllers/register-conversation-widget-app-controller'

export const createRegisterConversationWidgetAppController = (): Controller => {
  return new RegisterConversationWidgetAppController()
}
