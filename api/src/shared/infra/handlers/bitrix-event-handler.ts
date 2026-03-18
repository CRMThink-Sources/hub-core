import type { EventHandler } from './event-registry'
import type { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'

export type BitrixEventHandler = EventHandler<IBX24MessageEvent>
