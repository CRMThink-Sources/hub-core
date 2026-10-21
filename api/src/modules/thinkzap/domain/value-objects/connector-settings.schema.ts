import z from 'zod'
import {
  ConnectorSettings,
  DEFAULT_CONNECTOR_SETTINGS,
} from './connector-settings'

/** Inteiro > 0 ou `null`; valor estranho cai no default só deste campo. */
function positiveIntOrNull() {
  return z.number().int().positive().nullable().optional().catch(undefined)
}

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
  /**
   * `.catch(undefined)` nos dois: valor estranho gravado à mão na SPA cai no default
   * só deste campo, em vez de reprovar o objeto e zerar os outros toggles.
   */
  dailyLimitEnabled: z.boolean().optional().catch(undefined),
  dailyLimit: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .catch(undefined),
  deviceMessageMirrorEnabled: z.boolean().optional().catch(undefined),
  cadenceEnabled: z.boolean().optional().catch(undefined),
  cadenceMaxMessages: positiveIntOrNull(),
  cadenceWindowMinutes: positiveIntOrNull(),
  cadencePauseEnabled: z.boolean().optional().catch(undefined),
  cadencePauseMinutes: positiveIntOrNull(),
  cadenceCountDeviceMessages: z.boolean().optional().catch(undefined),
})

/**
 * O `.catch(undefined)` deixa a chave presente com `undefined`; espalhada por cima
 * do default ou do valor atual, ela apagaria o que devia preservar.
 */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>
}

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
    ...definedOnly(parsed.data),
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
    ...definedOnly(parsedPartial.data),
  }
}
