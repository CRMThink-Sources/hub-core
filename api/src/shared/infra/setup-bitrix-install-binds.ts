import { BitrixInstallBindRegistry } from './bitrix-install-bind-registry'
import { ThinkersZapInstallBindHandler } from '@/modules/thinkzap/infra/thinkerszap-install-bind.handler'
import { ClicksignInstallBindHandler } from '@/modules/clicksign/infra/install/clicksign-install-bind.handler'

const registry = new BitrixInstallBindRegistry()

// Registra handlers por app - adicione novos apps aqui
registry.register(new ThinkersZapInstallBindHandler())
registry.register(new ClicksignInstallBindHandler())

export const bitrixInstallBindRegistry = registry
