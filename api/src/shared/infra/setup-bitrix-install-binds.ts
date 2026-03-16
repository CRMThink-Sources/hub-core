import { BitrixInstallBindRegistry } from "./bitrix-install-bind-registry";
import { ThinkersZapInstallBindHandler } from "@/modules/thinkzap/infra/thinkerszap-install-bind.handler";

const registry = new BitrixInstallBindRegistry();

// Registra handlers por app - adicione novos apps aqui
registry.register(new ThinkersZapInstallBindHandler());

export const bitrixInstallBindRegistry = registry;
