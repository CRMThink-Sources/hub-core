import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiConnectedEvent } from './z-api'

export class ZApiConnectedHandler implements ZApiEventHandler {
  eventType = 'ConnectedCallback'

  async handle(event: ZApiConnectedEvent): Promise<void> {
    console.log('Connected', event)
    await Promise.resolve()
  }
}
