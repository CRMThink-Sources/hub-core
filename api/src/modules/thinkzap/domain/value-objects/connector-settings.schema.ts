import z from 'zod'
import {
  ConnectorSettings,
  DEFAULT_CONNECTOR_SETTINGS,
} from './connector-settings'

const connectorSettingsSchema = z.object({
  prefixOperatorNameEnabled: z.boolean().optional(),
  messageUpdateEventEnabled: z.boolean().optional(),
  messageDeleteEventEnabled: z.boolean().optional(),
  widgetOpenChannelEnabled: z.boolean().optional(),
})

export function parseConnectorSettings(raw: unknown): ConnectorSettings {
  if (
    raw == null ||
    (typeof raw === 'object' && Object.keys(raw).length === 0)
  ) {
    return { ...DEFAULT_CONNECTOR_SETTINGS }
  }

  const parsed = connectorSettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { ...DEFAULT_CONNECTOR_SETTINGS }
  }

  return {
    ...DEFAULT_CONNECTOR_SETTINGS,
    ...parsed.data,
  }
}

export function mergeConnectorSettings(
  current: ConnectorSettings,
  partial: Partial<ConnectorSettings>,
): ConnectorSettings {
  const parsedPartial = connectorSettingsSchema.safeParse(partial)
  if (!parsedPartial.success) {
    return current
  }

  return {
    ...current,
    ...parsedPartial.data,
  }
}
