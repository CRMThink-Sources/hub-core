import { getIo } from '../../socket'
import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiDisconectedEvent } from './z-api'

export class ZApiDisconectedHandler implements ZApiEventHandler {
  eventType = 'DisconnectedCallback'

  async handle(event: ZApiDisconectedEvent): Promise<void> {
    console.log('Disconnected', event)
    getIo().emit('connector:disconnected', event)
    await Promise.resolve()
  }
}
