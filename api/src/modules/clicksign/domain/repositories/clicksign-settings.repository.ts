export type ClickSignSettings = {
  fields: unknown
  verifySettings: unknown
  contactSettings: unknown
  dealSettings: unknown
  groups: unknown
}

export type ClickSignSettingsPatch = Partial<ClickSignSettings>

export interface ClickSignSettingsRepository {
  findByAppId(appId: string): Promise<ClickSignSettings | null>
  upsertByAppId(
    appId: string,
    patch: ClickSignSettingsPatch,
  ): Promise<ClickSignSettings>
}
