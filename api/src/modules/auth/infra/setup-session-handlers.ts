import { ThinkzapSessionHandler } from '@/modules/thinkzap/infra/thinkzap-session.handler'
import { ThinkAnaliseSessionHandler } from '@/modules/thinkanalise/infra/thinkanalise-session.handler'
import { SessionRegistry } from './session-registry'

const registry = new SessionRegistry()

registry.register(new ThinkzapSessionHandler())
registry.register(new ThinkAnaliseSessionHandler())

export const sessionRegistry = registry
