import type { EventHandler } from './event-registry'
import type {
  ReceivedMessageEvent,
  ZApiConnectedEvent,
  ZApiDisconectedEvent,
} from './z-api/z-api'

export type ZApiEventHandler = EventHandler<
  ReceivedMessageEvent | ZApiConnectedEvent | ZApiDisconectedEvent
>
