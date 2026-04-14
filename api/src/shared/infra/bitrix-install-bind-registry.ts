import type {
  BitrixInstallBind,
  BitrixInstallBindHandler,
} from '@/shared/domain/bitrix-install-bind'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

export class BitrixInstallBindRegistry {
  private handlers = new Map<string, BitrixInstallBindHandler>()

  register(handler: BitrixInstallBindHandler): void {
    this.handlers.set(handler.appCode, handler)
  }

  getBindsForApp(appCode: string): BitrixInstallBind[] {
    const handler = this.handlers.get(appCode)
    if (!handler) return []
    return handler.getBinds()
  }

  async runOnInstall(appCode: string, client: BitrixRestClient): Promise<void> {
    const handler = this.handlers.get(appCode)
    if (handler?.onInstall) {
      await handler.onInstall(client)
    }
  }

  hasApp(appCode: string): boolean {
    return this.handlers.has(appCode)
  }
}
