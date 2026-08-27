import z from 'zod'
import {
  ConnectorSettings,
  DEFAULT_CONNECTOR_SETTINGS,
} from './connector-settings'

/**
 * **`z.object` e nunca `z.strict()`.** O strip de chave desconhecida é o que faz o
 * valor gravado antes da descontinuação continuar servindo: quase todo item da SPA
 * carrega as duas chaves de evento, e reprovar por causa delas mandaria a base
 * inteira para `DEFAULT_CONNECTOR_SETTINGS` — religando `prefixOperatorNameEnabled`
 * em todo cliente que o desligou, sem erro, sem log, sem chamado.
 */
const connectorSettingsSchema = z.object({
  prefixOperatorNameEnabled: z.boolean().optional(),
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
