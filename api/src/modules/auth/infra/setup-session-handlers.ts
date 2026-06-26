import { ThinkzapSessionHandler } from '@/modules/thinkzap/infra/thinkzap-session.handler'
import { ThinkAnaliseSessionHandler } from '@/modules/thinkanalise/infra/thinkanalise-session.handler'
import { ImportSheetSessionHandler } from '@/modules/importsheet/infra/importsheet-session.handler'
import { ClickSignSessionHandler } from '@/modules/clicksign/infra/clicksign-session.handler'
import { SessionRegistry } from './session-registry'

const registry = new SessionRegistry()

registry.register(new ThinkzapSessionHandler())
registry.register(new ThinkAnaliseSessionHandler())
registry.register(new ImportSheetSessionHandler())
registry.register(new ClickSignSessionHandler())

export const sessionRegistry = registry
