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

type Destination = {
  id: string
  label: string
  phone: string
}

type EntityId = {
  entityTypeId: EntityTypeId
  id: string
}

type ListDestinationsInput = {
  contextId: string
  placement: string
}

export class ListDestinationsService {
  constructor(private readonly bitrix: BitrixClient) {}

  async execute(input: ListDestinationsInput): Promise<{
    destinations: Destination[]
    entity: Record<string, unknown>
  }> {
    const {
      result: { item: entity },
    } = await this.bitrix.getCrmItem(
      ENTITY_TYPE_ID[input.placement as keyof typeof ENTITY_TYPE_ID],
      input.contextId,
    )

    const ids = await this.getRelatedDestinationIds(
      input.placement,
      entity,
      input.contextId,
    )

    const destinationsRaw: Destination[] = []
    await Promise.all(
      ids.map(async id => {
        try {
          const {
            result: { item },
          } = await this.bitrix.getCrmItem(id.entityTypeId, id.id)
          destinationsRaw.push(
            ...this.buildDestinationsFromEntity(item, id.id, id.entityTypeId),
          )
        } catch (error) {
          console.error('error getting destination:', (error as Error).message)
        }
      }),
    )

    const destinations = this.deduplicateByPhone(destinationsRaw)

    return { destinations, entity }
  }

  private async getRelatedDestinationIds(
    placement: string,
    entity: Record<string, unknown>,
    contextId: string,
  ): Promise<EntityId[]> {
    if (placement === 'CRM_DEAL_DETAIL_TAB')
      return this.getDealDestinations(entity, contextId)
    if (placement === 'CRM_CONTACT_DETAIL_TAB')
      return this.getContactDestinations(entity, contextId)
    if (placement === 'CRM_LEAD_DETAIL_TAB')
      return this.getLeadDestinations(entity, contextId)
    if (placement === 'CRM_COMPANY_DETAIL_TAB')
      return this.getCompanyDestinations(contextId)
    return []
  }

  private async getDealDestinations(
    entity: Record<string, unknown>,
    dealId: string,
  ): Promise<EntityId[]> {
    const results: EntityId[] = []

    const [contactIds, companyContactIds] = await Promise.all([
      this.bitrix.getDealContactIds(dealId).catch(err => {
        console.error('error getting deal contact ids:', (err as Error).message)
        return [] as string[]
      }),
      this.getCompanyContactIdsFromEntity(entity),
    ])

    for (const id of contactIds) {
      results.push({ entityTypeId: 3, id })
    }
    for (const id of companyContactIds) {
      results.push({ entityTypeId: 3, id })
    }

    const leadId = this.getEntityId(entity, 'leadId', 1)
    if (leadId) results.push(leadId)

    return results
  }

  private async getContactDestinations(
    entity: Record<string, unknown>,
    contextId: string,
  ): Promise<EntityId[]> {
    const results: EntityId[] = [{ entityTypeId: 3, id: contextId }]

    const companyContactIds = await this.getCompanyContactIdsFromEntity(entity)
    for (const id of companyContactIds) {
      results.push({ entityTypeId: 3, id })
    }

    const leadId = this.getEntityId(entity, 'leadId', 1)
    if (leadId) results.push(leadId)

    return results
  }

  private async getLeadDestinations(
    entity: Record<string, unknown>,
    contextId: string,
  ): Promise<EntityId[]> {
    const results: EntityId[] = [{ entityTypeId: 1, id: contextId }]
    const companyContactIds = await this.getCompanyContactIdsFromEntity(entity)
    for (const id of companyContactIds) {
      results.push({ entityTypeId: 3, id })
    }
    return results
  }

  private async getCompanyDestinations(contextId: string): Promise<EntityId[]> {
    const results: EntityId[] = [{ entityTypeId: 4, id: contextId }]

    const contactIds = await this.bitrix
      .getCompanyContactIds(contextId)
      .catch(err => {
        console.error(
          'error getting company contact ids:',
          (err as Error).message,
        )
        return [] as string[]
      })

    for (const id of contactIds) {
      results.push({ entityTypeId: 3, id })
    }

    return results
  }

  private async getCompanyContactIdsFromEntity(
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

    return this.bitrix.getCompanyContactIds(companyId).catch(err => {
      console.error(
        'error getting company contact ids:',
        (err as Error).message,
      )
      return [] as string[]
    })
  }

  private getEntityId(
    entity: Record<string, unknown>,
    key: string,
    entityTypeId: EntityTypeId,
  ): EntityId | null {
    let value: string | number | null = entity[key] as string | number | null
    if (typeof value === 'number') value = value.toString()
    if (!value) return null
    return { entityTypeId, id: value }
  }

  private deduplicateByPhone(destinations: Destination[]): Destination[] {
    const seen = new Map<string, Destination>()
    for (const d of destinations) {
      if (!seen.has(d.phone)) seen.set(d.phone, d)
    }
    return Array.from(seen.values())
  }

  private buildDestinationsFromEntity(
    entity: Record<string, unknown>,
    id: string,
    entityTypeId: EntityTypeId,
  ): Destination[] {
    const labelName = this.getEntityDisplayName(entity)
    const labelPrefix = entityLabel[entityTypeId] ?? ''

    return this.extractPhoneNumbers(entity).map(number => ({
      id,
      label: `${labelPrefix} - ${labelName}`,
      phone: number,
    }))
  }

  private getEntityDisplayName(entity: Record<string, unknown>): string {
    if (typeof entity.name === 'string') return entity.name
    if (typeof entity.title === 'string') return entity.title
    return ''
  }

  private extractPhoneNumbers(entity: Record<string, unknown>): string[] {
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
}
