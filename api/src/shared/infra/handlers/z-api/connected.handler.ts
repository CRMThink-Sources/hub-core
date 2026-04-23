import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiConnectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'

export class ZApiConnectedHandler implements ZApiEventHandler {
  eventType = 'ConnectedCallback'

  async handle(event: ZApiConnectedEvent): Promise<void> {
    console.log('Connected', event)
    getIo().to(event.instanceId).emit('instance:connected', event)
    await Promise.resolve()
  }
}
