import type { EventHandler } from './event-registry'
import type { ReceivedMessageEvent } from './z-api/z-api'

export type ZApiEventHandler = EventHandler<ReceivedMessageEvent>
