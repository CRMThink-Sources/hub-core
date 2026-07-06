import { describe, expect, it, vi } from 'vitest'
import {
  bizprocEntityToPlacement,
  resolveRelatedDestinations,
} from './related-destinations.resolver'

const makeBitrix = (
  overrides: Partial<{
    getCrmItem: ReturnType<typeof vi.fn>
    getDealContactIds: ReturnType<typeof vi.fn>
    getCompanyContactIds: ReturnType<typeof vi.fn>
  }> = {},
) => ({
  getCrmItem: vi.fn(),
  getDealContactIds: vi.fn().mockResolvedValue([]),
  getCompanyContactIds: vi.fn().mockResolvedValue([]),
  ...overrides,
})

const crmItem = (
  id: string,
  name: string,
  phone?: string,
  extra: Record<string, unknown> = {},
) => ({
  result: {
    item: {
      id,
      name,
      fm: phone ? [{ typeId: 'PHONE', value: phone }] : [],
      ...extra,
    },
  },
})

describe('bizprocEntityToPlacement', () => {
  it('maps known entities to their CRM placement', () => {
    expect(bizprocEntityToPlacement('DEAL')).toBe('CRM_DEAL_DETAIL_TAB')
    expect(bizprocEntityToPlacement('LEAD')).toBe('CRM_LEAD_DETAIL_TAB')
    expect(bizprocEntityToPlacement('CONTACT')).toBe('CRM_CONTACT_DETAIL_TAB')
    expect(bizprocEntityToPlacement('COMPANY')).toBe('CRM_COMPANY_DETAIL_TAB')
  })

  it('is case-insensitive', () => {
    expect(bizprocEntityToPlacement('deal')).toBe('CRM_DEAL_DETAIL_TAB')
  })

  it('returns null for unknown entities', () => {
    expect(bizprocEntityToPlacement('INVOICE')).toBeNull()
    expect(bizprocEntityToPlacement('')).toBeNull()
  })
})

describe('resolveRelatedDestinations', () => {
  it('deduplicates destinations by phone across related contacts', async () => {
    const dealEntity = crmItem('10', 'Deal X')
    const contactA = crmItem('100', 'Maria', '5511000000000')
    const contactB = crmItem('101', 'Maria dup', '5511000000000')
    const getCrmItem = vi
      .fn()
      .mockImplementation((entityTypeId: number, id: string) => {
        if (entityTypeId === 2 && id === '10')
          return Promise.resolve(dealEntity)
        if (entityTypeId === 3 && id === '100') return Promise.resolve(contactA)
        if (entityTypeId === 3 && id === '101') return Promise.resolve(contactB)
        return Promise.reject(new Error(`unexpected(${entityTypeId},${id})`))
      })
    const bitrix = makeBitrix({
      getCrmItem,
      getDealContactIds: vi.fn().mockResolvedValue(['100', '101']),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_DEAL_DETAIL_TAB',
      '10',
    )

    const matching = destinations.filter(d => d.phone === '5511000000000')
    expect(matching).toHaveLength(1)
  })

  it('returns no destinations for an unknown placement', async () => {
    const bitrix = makeBitrix({
      getCrmItem: vi.fn().mockResolvedValue(crmItem('1', 'X')),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_UNKNOWN_TAB',
      '1',
    )

    expect(destinations).toEqual([])
  })
})
