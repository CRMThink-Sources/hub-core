import { prisma } from '@/config/prisma.js'
import {
  ClickSignSettings,
  ClickSignSettingsPatch,
  ClickSignSettingsRepository,
} from '@/modules/clicksign/domain/repositories/clicksign-settings.repository'
import { Prisma } from '@/prisma/client'

type Row = {
  fields: Prisma.JsonValue | null
  verifySettings: Prisma.JsonValue | null
  contactSettings: Prisma.JsonValue | null
  dealSettings: Prisma.JsonValue | null
  groups: Prisma.JsonValue | null
}

function toDomain(row: Row): ClickSignSettings {
  return {
    fields: row.fields,
    verifySettings: row.verifySettings,
    contactSettings: row.contactSettings,
    dealSettings: row.dealSettings,
    groups: row.groups,
  }
}

function toData(
  patch: ClickSignSettingsPatch,
): Record<string, Prisma.InputJsonValue> {
  const data: Record<string, Prisma.InputJsonValue> = {}
  if ('fields' in patch) data.fields = patch.fields as Prisma.InputJsonValue
  if ('verifySettings' in patch)
    data.verifySettings = patch.verifySettings as Prisma.InputJsonValue
  if ('contactSettings' in patch)
    data.contactSettings = patch.contactSettings as Prisma.InputJsonValue
  if ('dealSettings' in patch)
    data.dealSettings = patch.dealSettings as Prisma.InputJsonValue
  if ('groups' in patch) data.groups = patch.groups as Prisma.InputJsonValue
  return data
}

export class PrismaClickSignSettingsRepository implements ClickSignSettingsRepository {
  async findByAppId(appId: string): Promise<ClickSignSettings | null> {
    const row = await prisma.clickSignSettings.findUnique({ where: { appId } })
    return row ? toDomain(row) : null
  }

  async upsertByAppId(
    appId: string,
    patch: ClickSignSettingsPatch,
  ): Promise<ClickSignSettings> {
    const data = toData(patch)
    const row = await prisma.clickSignSettings.upsert({
      where: { appId },
      create: { appId, ...data },
      update: data,
    })
    return toDomain(row)
  }
}
