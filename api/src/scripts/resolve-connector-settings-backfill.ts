import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import { parseConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings.schema'

/**
 * Decisões puras do backfill de `ConnectorSettings` para a SPA.
 *
 * Separadas do script (`backfill-connector-settings-to-spa.ts`) porque ele executa
 * `main()` no import — mesma divisão de `resolve-message-anchor.ts`. É aqui que
 * mora o critério de idempotência, que é a parte do backfill que não pode estar
 * errada: sobrescrever configuração de cliente é irreversível.
 */

/**
 * O campo da SPA já carrega configuração?
 *
 * Só string com JSON de objeto conta. String vazia, `null`, campo ausente e JSON
 * torto são "vazio" — o mapper de leitura já degrada os três em
 * `DEFAULT_CONNECTOR_SETTINGS`, então sobrescrever não perde nada e é o que a
 * migração existe para fazer.
 */
export function hasPersistedSettings(raw: unknown): boolean {
  if (typeof raw !== 'string' || raw.trim() === '') return false

  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null
  } catch {
    return false
  }
}

/**
 * O que a coluna `settings` do banco tem de migrável.
 *
 * `null` quando a coluna não carrega informação nenhuma — ausente, `null`, `{}`,
 * ou valor que não é objeto. Nesses casos gravar os defaults no item não mudaria
 * nada observável (a leitura já resolve default para campo vazio) e gastaria um
 * `crm.item.update` por linha.
 *
 * Shape parcial ou com chave estranha **é** migrável: `parseConnectorSettings`
 * completa com os defaults, e é o mesmo resultado que o leitor antigo via na
 * coluna — migrar é preservar o comportamento que o cliente tinha.
 */
export function settingsToMigrate(
  rawColumn: unknown,
): ConnectorSettings | null {
  if (rawColumn == null) return null
  if (typeof rawColumn !== 'object') return null
  if (Object.keys(rawColumn).length === 0) return null

  return parseConnectorSettings(rawColumn)
}
