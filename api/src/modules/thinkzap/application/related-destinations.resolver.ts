import { BitrixClient } from '@/shared/infra/clients/bitrix.client'

const entityLabel = {
  4: 'Empresa',
  3: 'Contato',
  2: 'Negócio',
  1: 'Lead',
} as const

export const ENTITY_TYPE_ID = {
  CRM_LEAD_DETAIL_TAB: 1,
  CRM_DEAL_DETAIL_TAB: 2,
  CRM_CONTACT_DETAIL_TAB: 3,
  CRM_COMPANY_DETAIL_TAB: 4,
} as const

type EntityTypeId = keyof typeof entityLabel

export type Destination = {
  id: string
  label: string
  phone: string
}

type EntityId = {
  entityTypeId: EntityTypeId
  id: string
}

/**
 * Maps a Bizproc `document_id` entity token (e.g. from `DEAL_123`) to the CRM
 * placement string used by the resolver. Returns null for unsupported entities.
 */
export function bizprocEntityToPlacement(entity: string): string | null {
  switch (entity.toUpperCase()) {
    case 'DEAL':
      return 'CRM_DEAL_DETAIL_TAB'
    case 'LEAD':
      return 'CRM_LEAD_DETAIL_TAB'
    case 'CONTACT':
      return 'CRM_CONTACT_DETAIL_TAB'
    case 'COMPANY':
      return 'CRM_COMPANY_DETAIL_TAB'
    default:
      return null
  }
}

/**
 * Resolves every deduplicated phone destination related to a CRM entity
 * (the entity itself plus related contacts / company contacts / linked lead).
 * Shared by the widget destination list and the Bizproc broadcast robot.
 */
export async function resolveRelatedDestinations(
  bitrix: BitrixClient,
  placement: string,
  contextId: string,
): Promise<{ destinations: Destination[]; entity: Record<string, unknown> }> {
  const {
    result: { item: entity },
  } = await bitrix.getCrmItem(
    ENTITY_TYPE_ID[placement as keyof typeof ENTITY_TYPE_ID],
    contextId,
  )

  const ids = await getRelatedDestinationIds(
    bitrix,
    placement,
    entity,
    contextId,
  )

  const destinationsRaw: Destination[] = []
  await Promise.all(
    ids.map(async id => {
      try {
        const {
          result: { item },
        } = await bitrix.getCrmItem(id.entityTypeId, id.id)
        destinationsRaw.push(
          ...buildDestinationsFromEntity(item, id.id, id.entityTypeId),
        )
      } catch (error) {
        console.error('error getting destination:', (error as Error).message)
      }
    }),
  )

  const destinations = deduplicateByPhone(destinationsRaw)

  return { destinations, entity }
}

async function getRelatedDestinationIds(
  bitrix: BitrixClient,
  placement: string,
  entity: Record<string, unknown>,
  contextId: string,
): Promise<EntityId[]> {
  if (placement === 'CRM_DEAL_DETAIL_TAB')
    return getDealDestinations(bitrix, entity, contextId)
  if (placement === 'CRM_CONTACT_DETAIL_TAB')
    return getContactDestinations(bitrix, entity, contextId)
  if (placement === 'CRM_LEAD_DETAIL_TAB')
    return getLeadDestinations(bitrix, entity, contextId)
  if (placement === 'CRM_COMPANY_DETAIL_TAB')
    return getCompanyDestinations(bitrix, contextId)
  return []
}

async function getDealDestinations(
  bitrix: BitrixClient,
  entity: Record<string, unknown>,
  dealId: string,
): Promise<EntityId[]> {
  const results: EntityId[] = []

  const [contactIds, companyContactIds] = await Promise.all([
    bitrix.getDealContactIds(dealId).catch(err => {
      console.error('error getting deal contact ids:', (err as Error).message)
      return [] as string[]
    }),
    getCompanyContactIdsFromEntity(bitrix, entity),
  ])

  for (const id of contactIds) {
    results.push({ entityTypeId: 3, id })
  }
  for (const id of companyContactIds) {
    results.push({ entityTypeId: 3, id })
  }

  const leadId = getEntityId(entity, 'leadId', 1)
  if (leadId) results.push(leadId)

  return results
}

async function getContactDestinations(
  bitrix: BitrixClient,
  entity: Record<string, unknown>,
  contextId: string,
): Promise<EntityId[]> {
  const results: EntityId[] = [{ entityTypeId: 3, id: contextId }]

  const companyContactIds = await getCompanyContactIdsFromEntity(bitrix, entity)
  for (const id of companyContactIds) {
    results.push({ entityTypeId: 3, id })
  }

  const leadId = getEntityId(entity, 'leadId', 1)
  if (leadId) results.push(leadId)

  return results
}

async function getLeadDestinations(
  bitrix: BitrixClient,
  entity: Record<string, unknown>,
  contextId: string,
): Promise<EntityId[]> {
  const results: EntityId[] = [{ entityTypeId: 1, id: contextId }]
  const companyContactIds = await getCompanyContactIdsFromEntity(bitrix, entity)
  for (const id of companyContactIds) {
    results.push({ entityTypeId: 3, id })
  }
  return results
}

async function getCompanyDestinations(
  bitrix: BitrixClient,
  contextId: string,
): Promise<EntityId[]> {
  const results: EntityId[] = [{ entityTypeId: 4, id: contextId }]

  const contactIds = await bitrix.getCompanyContactIds(contextId).catch(err => {
    console.error('error getting company contact ids:', (err as Error).message)
    return [] as string[]
  })

  for (const id of contactIds) {
    results.push({ entityTypeId: 3, id })
  }

  return results
}

async function getCompanyContactIdsFromEntity(
  bitrix: BitrixClient,
  entity: Record<string, unknown>,
): Promise<string[]> {
  const companyIdRaw = entity['companyId']
  const companyId =
    typeof companyIdRaw === 'number'
      ? String(companyIdRaw)
      : typeof companyIdRaw === 'string' && companyIdRaw
        ? companyIdRaw
        : null
  if (!companyId) return []

  return bitrix.getCompanyContactIds(companyId).catch(err => {
    console.error('error getting company contact ids:', (err as Error).message)
    return [] as string[]
  })
}

function getEntityId(
  entity: Record<string, unknown>,
  key: string,
  entityTypeId: EntityTypeId,
): EntityId | null {
  let value: string | number | null = entity[key] as string | number | null
  if (typeof value === 'number') value = value.toString()
  if (!value) return null
  return { entityTypeId, id: value }
}

function deduplicateByPhone(destinations: Destination[]): Destination[] {
  const seen = new Map<string, Destination>()
  for (const d of destinations) {
    if (!seen.has(d.phone)) seen.set(d.phone, d)
  }
  return Array.from(seen.values())
}

function buildDestinationsFromEntity(
  entity: Record<string, unknown>,
  id: string,
  entityTypeId: EntityTypeId,
): Destination[] {
  const labelName = getEntityDisplayName(entity)
  const labelPrefix = entityLabel[entityTypeId] ?? ''

  return extractPhoneNumbers(entity).map(number => ({
    id,
    label: `${labelPrefix} - ${labelName}`,
    phone: number,
  }))
}

function getEntityDisplayName(entity: Record<string, unknown>): string {
  if (typeof entity.name === 'string') return entity.name
  if (typeof entity.title === 'string') return entity.title
  return ''
}

function extractPhoneNumbers(entity: Record<string, unknown>): string[] {
  const fm = entity.fm
  if (!Array.isArray(fm)) return []

  const phones: string[] = []
  for (const item of fm) {
    if (!item || typeof item !== 'object') continue
    const fmItem = item as Record<string, unknown>
    const typeId = typeof fmItem.typeId === 'string' ? fmItem.typeId : null
    const value = typeof fmItem.value === 'string' ? fmItem.value : null

    if (typeId !== 'PHONE' || !value) continue

    for (const number of value.split(',')) {
      const trimmed = number.trim()
      if (trimmed) phones.push(trimmed)
    }
  }

  return phones
}
