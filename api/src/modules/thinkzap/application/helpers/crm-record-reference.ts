import { entityTypeIdFromWidgetEntity } from '@/modules/thinkzap/domain/template-variable-mapping'

/** Os tipos com rota própria no CRM; SPA usa `/crm/type/{n}`. */
const NATIVE_PATHS: Record<number, string> = {
  1: 'lead',
  2: 'deal',
  3: 'contact',
  4: 'company',
}

/**
 * O registro do CRM de um disparo, a partir do que widget (`deal`) e robô (`DEAL`)
 * gravam. `null` quando não é um registro do CRM que se possa abrir: entidade
 * desconhecida ou id não numérico, que iria cru para a URL.
 *
 * lead=1, deal=2, contact=3, company=4, dynamic_<n>=n; sem diferenciar maiúsculas.
 */
export function crmRecordReference(
  entity: string,
  entityId: string,
): { entityTypeId: number; url: string } | null {
  const entityTypeId = entityTypeIdFromWidgetEntity(entity)
  if (entityTypeId === null || !/^\d+$/.test(entityId)) return null

  const native = NATIVE_PATHS[entityTypeId]
  const path = native ?? `type/${entityTypeId}`

  return { entityTypeId, url: `/crm/${path}/details/${entityId}/` }
}
