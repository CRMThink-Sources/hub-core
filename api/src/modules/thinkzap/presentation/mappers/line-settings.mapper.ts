import type { LineSettingsReading } from '@/modules/thinkzap/application/get-line-settings'
import type { LineEntitlement } from '@/modules/thinkzap/domain/connector-trial'
import type { DailyLimitUsage } from '@/modules/thinkzap/domain/daily-send-limit'
import type { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'

/**
 * Ajustes da linha. Explícito campo por campo: a leitura passa pelo item da SPA,
 * que carrega `zApiInstanceToken` — e credencial nunca sai em resposta HTTP.
 *
 * Não existe mais `provisioned: false` nem `channelLinkAvailable`: toggles e
 * vínculo de canal vivem os dois no item, então nenhuma parte da aba depende de
 * registro em `Instance`.
 */
export type LineSettingsView = {
  /** Nome como o usuário digitou, já sem o prefixo do domínio. */
  name: string
  /** `null` = nenhum canal aberto do Bitrix vinculado. */
  vinculatedChannel: string | null
  settings: ConnectorSettings
  /**
   * `active` | `trial-expired` | `inactive`. A aba abre em qualquer um deles; nos
   * dois últimos ela renderiza só-leitura, porque a gravação recusa com `402`.
   */
  entitlement: LineEntitlement
  /**
   * Uso do limite diário de hoje. Ausente na linha oficial (que não tem limite);
   * `null` na Z-API quando o contador não pôde ser lido.
   */
  dailyLimit?: DailyLimitUsage | null
}

export const mapLineSettingsToView = (
  reading: LineSettingsReading,
): LineSettingsView => ({
  name: reading.name,
  vinculatedChannel: reading.vinculatedChannel,
  entitlement: reading.entitlement,
  settings: {
    prefixOperatorNameEnabled:
      reading.settings.prefixOperatorNameEnabled === true,
    widgetOpenChannelEnabled:
      reading.settings.widgetOpenChannelEnabled === true,
    dailyLimitEnabled: reading.settings.dailyLimitEnabled === true,
    dailyLimit: reading.settings.dailyLimit ?? null,
    deviceMessageMirrorEnabled:
      reading.settings.deviceMessageMirrorEnabled === true,
  },
  ...(reading.provider === 'ZAPI' ? { dailyLimit: reading.dailyLimit } : {}),
})
