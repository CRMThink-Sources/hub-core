import { prisma } from '@/config/prisma'
import type { InsightsConfig } from '@/modules/thinkzap/domain/insights-config'
import type {
  InsightsSettings,
  InsightsSettingsRepository,
} from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'

export class PrismaInsightsSettingsRepository implements InsightsSettingsRepository {
  async get(appId: string): Promise<InsightsSettings | null> {
    const row = await prisma.thinkzapInsightsSettings.findUnique({
      where: { appId },
    })
    if (!row) return null
    return {
      keyEnc: row.vibecodeKeyEnc,
      last4: row.vibecodeKeyLast4,
      portalId: row.vibecodePortalId,
      validatedAt: row.vibecodeValidatedAt,
      config: (row.config as Partial<InsightsConfig> | null) ?? null,
    }
  }

  async saveKey(
    appId: string,
    k: {
      keyEnc: string
      last4: string
      portalId: string | null
      validatedAt: Date
    },
  ): Promise<void> {
    const data = {
      vibecodeKeyEnc: k.keyEnc,
      vibecodeKeyLast4: k.last4,
      vibecodePortalId: k.portalId,
      vibecodeValidatedAt: k.validatedAt,
    }
    await prisma.thinkzapInsightsSettings.upsert({
      where: { appId },
      create: { appId, ...data },
      update: data,
    })
  }

  /** `updateMany` para não falhar se a linha ainda não existir. */
  async removeKey(appId: string): Promise<void> {
    await prisma.thinkzapInsightsSettings.updateMany({
      where: { appId },
      data: {
        vibecodeKeyEnc: null,
        vibecodeKeyLast4: null,
        vibecodePortalId: null,
        vibecodeValidatedAt: null,
      },
    })
  }

  async saveConfig(appId: string, config: InsightsConfig): Promise<void> {
    await prisma.thinkzapInsightsSettings.upsert({
      where: { appId },
      create: { appId, config },
      update: { config },
    })
  }
}
