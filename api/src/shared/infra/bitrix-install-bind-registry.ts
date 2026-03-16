import type { BitrixInstallBind, BitrixInstallBindHandler } from "@/shared/domain/bitrix-install-bind";

export class BitrixInstallBindRegistry {
  private handlers = new Map<string, BitrixInstallBindHandler>();

  register(handler: BitrixInstallBindHandler): void {
    this.handlers.set(handler.appCode, handler);
  }

  getBindsForApp(appCode: string): BitrixInstallBind[] {
    const handler = this.handlers.get(appCode);
    if (!handler) return [];
    return handler.getBinds();
  }

  hasApp(appCode: string): boolean {
    return this.handlers.has(appCode);
  }
}
