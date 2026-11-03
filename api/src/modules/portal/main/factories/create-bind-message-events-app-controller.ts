import { Controller } from '@/shared/presentation/controller'
import { BindMessageEventsAppController } from '../../presentation/controllers/bind-message-events-app-controller'

export const createBindMessageEventsAppController = (): Controller => {
  return new BindMessageEventsAppController()
}
