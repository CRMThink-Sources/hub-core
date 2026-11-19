import type { InsightsSettingsRepository } from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'
import { clearKeyProblem } from './key-health'

/** Remove a chave (a configuração do cliente é preservada pelo repositório). */
export class RemoveVibecodeKey {
  constructor(
    private readonly deps: { settings: InsightsSettingsRepository },
  ) {}

  async execute(appId: string): Promise<void> {
    await this.deps.settings.removeKey(appId)
    await clearKeyProblem(appId)
  }
}
