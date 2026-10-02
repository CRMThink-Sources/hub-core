import { describe, expect, it } from 'vitest'
import { resolveWidgetEntity } from './resolve-widget-entity'

describe('resolveWidgetEntity', () => {
  it.each([
    ['CRM_DEAL_DETAIL_TAB', 'deal'],
    ['CRM_LEAD_DETAIL_TAB', 'lead'],
    ['CRM_CONTACT_DETAIL_TAB', 'contact'],
    ['CRM_COMPANY_DETAIL_TAB', 'company'],
  ])('maps %s to %s', (placement, entity) => {
    expect(resolveWidgetEntity(placement, { ID: '42' })).toEqual({
      entity,
      entityId: '42',
    })
  })

  it('maps SPA placement to DYNAMIC_<entityTypeId>', () => {
    expect(
      resolveWidgetEntity('CRM_DYNAMIC_1060_DETAIL_TAB', { ID: '1613' }),
    ).toEqual({ entity: 'DYNAMIC_1060', entityId: '1613' })
  })

  it('accepts a numeric ID', () => {
    expect(
      resolveWidgetEntity('CRM_DYNAMIC_1060_DETAIL_TAB', { ID: 1613 }),
    ).toEqual({ entity: 'DYNAMIC_1060', entityId: '1613' })
  })

  it('returns null for an unknown placement', () => {
    expect(resolveWidgetEntity('CRM_QUOTE_DETAIL_TAB', { ID: '1' })).toBeNull()
    expect(resolveWidgetEntity(undefined, { ID: '1' })).toBeNull()
  })

  it('returns null when ID is missing', () => {
    expect(resolveWidgetEntity('CRM_DEAL_DETAIL_TAB', {})).toBeNull()
    expect(resolveWidgetEntity('CRM_DEAL_DETAIL_TAB', undefined)).toBeNull()
    expect(resolveWidgetEntity('CRM_DEAL_DETAIL_TAB', { ID: '' })).toBeNull()
  })
})
