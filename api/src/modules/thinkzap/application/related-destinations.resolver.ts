import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

const entityLabel: Record<number, string> = {
  4: 'Empresa',
  3: 'Contato',
  2: 'Negócio',
  1: 'Lead',
}

export const ENTITY_TYPE_ID = {
  CRM_LEAD_DETAIL_TAB: 1,
  CRM_DEAL_DETAIL_TAB: 2,
  CRM_CONTACT_DETAIL_TAB: 3,
  CRM_COMPANY_DETAIL_TAB: 4,
} as const

/**
 * `CRM_DYNAMIC_<entityTypeId>_DETAIL_TAB` — placement de aba de SPA dinâmica
 * (`spa-placement-registration`). `entityTypeId` é arbitrário (1060, 1142,
 * ...), por isso não cabe no mapa estático acima.
 */
const DYNAMIC_PLACEMENT_PATTERN = /^CRM_DYNAMIC_(\d+)_DETAIL_TAB$/

/**
 * `number`, e não `1|2|3|4`: SPA dinâmica traz `entityTypeId` arbitrário, fora
 * das 4 entidades estáticas conhecidas por este resolver.
 */
type EntityTypeId = number

/**
 * Resolve o `entityTypeId` do placement: mapa estático primeiro, senão o
 * padrão `CRM_DYNAMIC_<id>_DETAIL_TAB`, senão `null` — placement que este
 * resolver não conhece.
 */
function resolveEntityTypeId(placement: string): EntityTypeId | null {
  const staticId = ENTITY_TYPE_ID[placement as keyof typeof ENTITY_TYPE_ID]
  if (staticId !== undefined) return staticId

  const dynamicMatch = DYNAMIC_PLACEMENT_PATTERN.exec(placement)
  if (dynamicMatch) return Number(dynamicMatch[1])

  return null
}

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
  const entityTypeId = resolveEntityTypeId(placement)
  if (entityTypeId === null) {
    throw new Error(`Unsupported placement: ${placement}`)
  }

  const {
    result: { item: entity },
  } = await bitrix.getCrmItem(entityTypeId, contextId)

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
        logThinkzapError(
          apiLogger,
          'thinkzap.message.related_destinations_failed',
          { app: 'thinkzap', subQuery: 'destination', err: error },
          { level: 'error', msg: 'error getting destination' },
        )
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

  /**
   * SPA dinâmica: o item em si é o único destino. Não há convenção genérica
   * de campo de vínculo (contato/empresa) entre entidades de SPA dinâmica
   * neste sistema — ver `BitrixSpaParentReader`, que recebe esse nome de
   * campo por parâmetro do chamador, não de um mapa universal.
   */
  const dynamicMatch = DYNAMIC_PLACEMENT_PATTERN.exec(placement)
  if (dynamicMatch) {
    return [{ entityTypeId: Number(dynamicMatch[1]), id: contextId }]
  }

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
      logThinkzapError(
        apiLogger,
        'thinkzap.message.related_destinations_failed',
        { app: 'thinkzap', subQuery: 'deal-contact-ids', err },
        { level: 'error', msg: 'error getting deal contact ids' },
      )
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

/**
 * Vínculos de um lead: o próprio lead mais o **cliente** ligado a ele.
 *
 * "Cliente" no lead do Bitrix é contato + empresa, e é onde o operador liga um
 * cadastro que já existe — o telefone costuma morar lá, não no lead. Por isso a
 * empresa entra como destino em si (`entityTypeId: 4`, telefones do `fm`) e não
 * só como fonte dos contatos dela.
 */
async function getLeadDestinations(
  bitrix: BitrixClient,
  entity: Record<string, unknown>,
  contextId: string,
): Promise<EntityId[]> {
  const results: EntityId[] = [{ entityTypeId: 1, id: contextId }]

  /**
   * As duas consultas correm juntas: são independentes, e serializá-las somaria
   * duas idas de rede à abertura do widget.
   */
  const [leadContactIds, companyContactIds] = await Promise.all([
    getLeadContactIdsWithFallback(bitrix, entity, contextId),
    getCompanyContactIdsFromEntity(bitrix, entity),
  ])

  for (const id of leadContactIds) {
    results.push({ entityTypeId: 3, id })
  }

  const companyId = readCompanyId(entity)
  if (companyId) results.push({ entityTypeId: 4, id: companyId })

  for (const id of companyContactIds) {
    results.push({ entityTypeId: 3, id })
  }

  return results
}

/**
 * Contatos ligados ao lead, por `crm.lead.contact.items.get` com fallback pelos
 * campos do item.
 *
 * As duas fontes existem porque nenhuma sozinha basta: `contactId` traz só o
 * contato principal em portal antigo — lead com dois contatos ligados perderia o
 * segundo — e depender apenas do método canônico deixaria uma falha de rede zerar
 * os contatos com `contactId` já em mãos, de graça, no item. O fallback só existe
 * para o caminho de falha: no caminho feliz as duas fontes dariam o mesmo
 * resultado depois da dedup por telefone.
 */
async function getLeadContactIdsWithFallback(
  bitrix: BitrixClient,
  entity: Record<string, unknown>,
  leadId: string,
): Promise<string[]> {
  const linked = await bitrix.getLeadContactIds(leadId).catch(err => {
    logThinkzapError(
      apiLogger,
      'thinkzap.message.related_destinations_failed',
      { app: 'thinkzap', subQuery: 'lead-contact-ids', err },
      { level: 'error', msg: 'error getting lead contact ids' },
    )
    return [] as string[]
  })

  if (linked.length > 0) return linked

  return readContactIdsFromEntity(entity)
}

/**
 * `contactId` (principal) e `contactIds` (múltiplo) do item, normalizados para
 * `string[]` sem repetição. Campo ausente em qualquer das duas formas vira lista
 * vazia — o item do lead nem sempre traz `contactIds`.
 */
function readContactIdsFromEntity(entity: Record<string, unknown>): string[] {
  const ids: string[] = []

  const single = readId(entity['contactId'])
  if (single) ids.push(single)

  const many = entity['contactIds']
  if (Array.isArray(many)) {
    for (const raw of many) {
      const id = readId(raw)
      if (id) ids.push(id)
    }
  }

  return Array.from(new Set(ids))
}

function readId(value: unknown): string | null {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value) return value
  return null
}

async function getCompanyDestinations(
  bitrix: BitrixClient,
  contextId: string,
): Promise<EntityId[]> {
  const results: EntityId[] = [{ entityTypeId: 4, id: contextId }]

  const contactIds = await bitrix.getCompanyContactIds(contextId).catch(err => {
    logThinkzapError(
      apiLogger,
      'thinkzap.message.related_destinations_failed',
      { app: 'thinkzap', subQuery: 'company-contact-ids', err },
      { level: 'error', msg: 'error getting company contact ids' },
    )
    return [] as string[]
  })

  for (const id of contactIds) {
    results.push({ entityTypeId: 3, id })
  }

  return results
}

function readCompanyId(entity: Record<string, unknown>): string | null {
  return readId(entity['companyId'])
}

async function getCompanyContactIdsFromEntity(
  bitrix: BitrixClient,
  entity: Record<string, unknown>,
): Promise<string[]> {
  const companyId = readCompanyId(entity)
  if (!companyId) return []

  return bitrix.getCompanyContactIds(companyId).catch(err => {
    logThinkzapError(
      apiLogger,
      'thinkzap.message.related_destinations_failed',
      { app: 'thinkzap', subQuery: 'company-contact-ids', err },
      { level: 'error', msg: 'error getting company contact ids' },
    )
    return [] as string[]
  })
}

function getEntityId(
  entity: Record<string, unknown>,
  key: string,
  entityTypeId: EntityTypeId,
): EntityId | null {
  const id = readId(entity[key])
  if (!id) return null
  return { entityTypeId, id }
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
