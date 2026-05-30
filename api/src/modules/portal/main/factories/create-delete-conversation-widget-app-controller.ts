import { Controller } from '@/shared/presentation/controller'
import { DeleteConversationWidgetAppController } from '../../presentation/controllers/delete-conversation-widget-app-controller'

export const createDeleteConversationWidgetAppController = (): Controller => {
  return new DeleteConversationWidgetAppController()
}
