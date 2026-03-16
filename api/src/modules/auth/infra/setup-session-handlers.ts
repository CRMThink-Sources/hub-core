import { ThinkzapSessionHandler } from '@/modules/thinkzap/infra/thinkzap-session.handler'
import { SessionRegistry } from './session-registry'

const registry = new SessionRegistry()

registry.register(new ThinkzapSessionHandler())

export const sessionRegistry = registry
