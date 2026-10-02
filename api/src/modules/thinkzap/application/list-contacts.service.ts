import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { apiLogger } from '@/shared/infra/logger'

const CONTACT_ENTITY_TYPE_ID = 3
const MAX_RESULTS = 20

export type ContactResult = {
  id: string
  name: string
  phones: string[]
}

export class ListContactsService {
  constructor(private readonly bitrix: BitrixClient) {}

  async execute(search: string): Promise<{ contacts: ContactResult[] }> {
    const query = search.trim()
    if (query.length < 2) {
      return { contacts: [] }
    }

    const {
      result: { items },
    } = await this.bitrix.listCrmItems(CONTACT_ENTITY_TYPE_ID, {
      '0': {
        logic: 'OR',
        '0': { '%name': query },
        '1': { '%lastName': query },
      },
    })

    const limited = items.slice(0, MAX_RESULTS)
    const contacts: ContactResult[] = []

    for (const item of limited) {
      try {
        const {
          result: { item: entity },
        } = await this.bitrix.getCrmItem(CONTACT_ENTITY_TYPE_ID, item.id)

        contacts.push({
          id: item.id,
          name: this.getEntityDisplayName(entity),
          phones: this.extractPhoneNumbers(entity),
        })
      } catch (error) {
        logThinkzapError(apiLogger, 'thinkzap.bitrix.contact_read_failed', {
          app: 'thinkzap',
          contactId: item.id,
          err: error,
        })
      }
    }

    return { contacts }
  }

  private getEntityDisplayName(entity: Record<string, unknown>): string {
    if (typeof entity.name === 'string' && entity.name) return entity.name
    if (typeof entity.title === 'string' && entity.title) return entity.title
    const firstName =
      typeof entity.firstName === 'string' ? entity.firstName : ''
    const lastName = typeof entity.lastName === 'string' ? entity.lastName : ''
    const full = `${firstName} ${lastName}`.trim()
    return full || 'Contato'
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
        if (trimmed && !phones.includes(trimmed)) phones.push(trimmed)
      }
    }

    return phones
  }
}
