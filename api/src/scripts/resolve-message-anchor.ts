/**
 * Parte pura do backfill de `instance_id`, extraída para ser testável sem banco.
 *
 * A resolução de âncora e a detecção de colisão são o núcleo de risco da change
 * `retire-instance-table`: uma colisão não detectada colapsa escopos de
 * idempotência e permite mensagem duplicada no CRM do cliente — sem erro, sem log.
 */

export type InstanceRow = {
  id: string
  instanceId: string
  channelId: string | null
  /** `null` = conector ausente, que resolve Z-API. */
  provider: string | null
}

/**
 * Âncora nova de uma instância.
 *
 * Z-API usa `instance_id`; HubMessage usa `channel_id`, que é o que o webhook
 * daquele provider entrega. Conector ausente resolve Z-API, mesma regra que o
 * contexto de webhook já usava.
 *
 * `null` = sem âncora: as mensagens daquela instância mantêm o uuid antigo.
 */
export function resolveAnchor(row: InstanceRow): string | null {
  if (row.provider === 'HUBMESSAGE') return row.channelId || null
  return row.instanceId || null
}

/**
 * Instâncias que resolvem para a mesma âncora, agrupadas por âncora.
 *
 * Vazio é o estado esperado: `Instance.instanceId` é `@unique`. Não-vazio é
 * bloqueante — tem que abortar antes do `ALTER TABLE`, não descobrir durante.
 */
export function findAnchorCollisions(
  instances: InstanceRow[],
): Map<string, InstanceRow[]> {
  const byAnchor = new Map<string, InstanceRow[]>()

  for (const row of instances) {
    const anchor = resolveAnchor(row)
    if (!anchor) continue
    byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), row])
  }

  return new Map([...byAnchor].filter(([, rows]) => rows.length > 1))
}
