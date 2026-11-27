import { describe, expect, it } from 'vitest'
import { crmRecordReference } from './crm-record-reference'

describe('crmRecordReference', () => {
  it.each([
    ['LEAD', 1, '/crm/lead/details/9/'],
    ['deal', 2, '/crm/deal/details/9/'],
    ['Contact', 3, '/crm/contact/details/9/'],
    ['COMPANY', 4, '/crm/company/details/9/'],
    ['DYNAMIC_128', 128, '/crm/type/128/details/9/'],
    ['dynamic_1060', 1060, '/crm/type/1060/details/9/'],
  ])('resolve %s', (entity, entityTypeId, url) => {
    expect(crmRecordReference(entity, '9')).toEqual({ entityTypeId, url })
  })

  it.each([
    ['task', '9'],
    ['', '9'],
    ['deal', ''],
    ['deal', 'abc'],
    ['deal', '9/../1'],
  ])('devolve null para (%s, %s)', (entity, entityId) => {
    expect(crmRecordReference(entity, entityId)).toBeNull()
  })
})
