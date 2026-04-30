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

    const destinations: Destination[] = []
    const ids = this.getRelatedDestinationIds(input.placement, entity)
    console.log({ ids })
    for (const id of ids) {
      try {
        const {
          result: { item },
        } = await this.bitrix.getCrmItem(id.entityTypeId, id.id)

        destinations.push(
          ...this.buildDestinationsFromEntity(item, id.id, id.entityTypeId),
        )
      } catch (error) {
        console.error('error getting destination:', (error as Error).message)
      }
    }

    const sourceEntityId = typeof entity.id === 'string' ? entity.id : ''
    const sourceEntityType = this.toEntityTypeId(entity.entityTypeId)
    if (sourceEntityType) {
      destinations.push(
        ...this.buildDestinationsFromEntity(
          entity,
          sourceEntityId,
          sourceEntityType,
        ),
      )
    }

    return { destinations, entity }
  }

  private getRelatedDestinationIds(
    placement: string,
    entity: Record<string, unknown>,
  ): EntityId[] {
    if (placement === 'CRM_DEAL_DETAIL_TAB')
      return this.getDealDestinations(entity)
    if (placement === 'CRM_CONTACT_DETAIL_TAB')
      return this.getContactDestinations(entity)
    return []
  }

  private getDealDestinations(entity: Record<string, unknown>): EntityId[] {
    console.log(this.getEntityId(entity, 'companyId', 4))
    return [
      this.getEntityId(entity, 'companyId', 4),
      this.getEntityId(entity, 'contactId', 3),
      this.getEntityId(entity, 'leadId', 1),
    ].filter((value): value is EntityId => value != null)
  }

  private getContactDestinations(entity: Record<string, unknown>): EntityId[] {
    return [
      this.getEntityId(entity, 'companyId', 4),
      this.getEntityId(entity, 'leadId', 1),
    ].filter((value): value is EntityId => value != null)
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

  private toEntityTypeId(value: unknown): EntityTypeId | null {
    if (value === 1 || value === 2 || value === 3 || value === 4) return value
    return null
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
