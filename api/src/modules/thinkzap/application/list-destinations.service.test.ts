import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ListDestinationsService } from './list-destinations.service'

const makeBitrix = (
  overrides: Partial<{
    getCrmItem: ReturnType<typeof vi.fn>
    getDealContactIds: ReturnType<typeof vi.fn>
    getCompanyContactIds: ReturnType<typeof vi.fn>
    getLeadContactIds: ReturnType<typeof vi.fn>
  }> = {},
) => ({
  getCrmItem: vi.fn(),
  getDealContactIds: vi.fn().mockResolvedValue([]),
  getCompanyContactIds: vi.fn().mockResolvedValue([]),
  getLeadContactIds: vi.fn().mockResolvedValue([]),
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

describe('ListDestinationsService — CRM_CONTACT_DETAIL_TAB', () => {
  it('includes the contact itself as a destination', async () => {
    const contactEntity = crmItem('42', 'João', '5511999999999')
    const bitrix = makeBitrix({
      getCrmItem: vi.fn().mockResolvedValue(contactEntity),
    })

    const service = new ListDestinationsService(bitrix as never)
    const { destinations } = await service.execute({
      contextId: '42',
      placement: 'CRM_CONTACT_DETAIL_TAB',
    })

    expect(destinations).toContainEqual(
      expect.objectContaining({ phone: '5511999999999' }),
    )
  })

  it('does not call getCompanyContactIds when contact has no companyId', async () => {
    const contactEntity = crmItem('42', 'João', '5511999999999')
    const getCompanyContactIds = vi.fn().mockResolvedValue([])
    const bitrix = makeBitrix({
      getCrmItem: vi.fn().mockResolvedValue(contactEntity),
      getCompanyContactIds,
    })

    const service = new ListDestinationsService(bitrix as never)
    await service.execute({
      contextId: '42',
      placement: 'CRM_CONTACT_DETAIL_TAB',
    })

    expect(getCompanyContactIds).not.toHaveBeenCalled()
  })
})

describe('ListDestinationsService — CRM_LEAD_DETAIL_TAB', () => {
  it('includes the lead itself as a destination', async () => {
    const leadEntity = crmItem('7', 'Lead X', '5521988887777')
    const bitrix = makeBitrix({
      getCrmItem: vi.fn().mockResolvedValue(leadEntity),
    })

    const service = new ListDestinationsService(bitrix as never)
    const { destinations } = await service.execute({
      contextId: '7',
      placement: 'CRM_LEAD_DETAIL_TAB',
    })

    expect(destinations).toContainEqual(
      expect.objectContaining({ phone: '5521988887777' }),
    )
  })

  it('does not call getCompanyContactIds when lead has no companyId', async () => {
    const leadEntity = crmItem('7', 'Lead X', '5521988887777')
    const getCompanyContactIds = vi.fn().mockResolvedValue([])
    const bitrix = makeBitrix({
      getCrmItem: vi.fn().mockResolvedValue(leadEntity),
      getCompanyContactIds,
    })

    const service = new ListDestinationsService(bitrix as never)
    await service.execute({ contextId: '7', placement: 'CRM_LEAD_DETAIL_TAB' })

    expect(getCompanyContactIds).not.toHaveBeenCalled()
  })
})

describe('ListDestinationsService — CRM_COMPANY_DETAIL_TAB', () => {
  it('returns destinations from linked contacts', async () => {
    const companyEntity = crmItem('5', 'Empresa A')
    const contactEntity = crmItem('100', 'Maria', '5511000000000')
    const getCrmItem = vi
      .fn()
      .mockImplementation((entityTypeId: number, id: string) => {
        if (entityTypeId === 4 && id === '5')
          return Promise.resolve(companyEntity)
        if (entityTypeId === 3 && id === '100')
          return Promise.resolve(contactEntity)
        return Promise.reject(
          new Error(`unexpected getCrmItem(${entityTypeId}, ${id})`),
        )
      })
    const getCompanyContactIds = vi.fn().mockResolvedValue(['100'])
    const bitrix = makeBitrix({ getCrmItem, getCompanyContactIds })

    const service = new ListDestinationsService(bitrix as never)
    const { destinations } = await service.execute({
      contextId: '5',
      placement: 'CRM_COMPANY_DETAIL_TAB',
    })

    expect(getCompanyContactIds).toHaveBeenCalledWith('5')
    expect(destinations).toContainEqual(
      expect.objectContaining({ phone: '5511000000000' }),
    )
  })

  it('returns company phone when company item has phone in fm field', async () => {
    const companyEntity = crmItem('5', 'Empresa A', '5531111111111')
    const getCrmItem = vi.fn().mockResolvedValue(companyEntity)
    const getCompanyContactIds = vi.fn().mockResolvedValue([])
    const bitrix = makeBitrix({ getCrmItem, getCompanyContactIds })

    const service = new ListDestinationsService(bitrix as never)
    const { destinations } = await service.execute({
      contextId: '5',
      placement: 'CRM_COMPANY_DETAIL_TAB',
    })

    expect(destinations).toContainEqual(
      expect.objectContaining({ phone: '5531111111111' }),
    )
  })

  it('returns empty destinations when company has no contacts and no phone', async () => {
    const companyEntity = crmItem('5', 'Empresa A')
    const getCrmItem = vi.fn().mockResolvedValue(companyEntity)
    const getCompanyContactIds = vi.fn().mockResolvedValue([])
    const bitrix = makeBitrix({ getCrmItem, getCompanyContactIds })

    const service = new ListDestinationsService(bitrix as never)
    const { destinations } = await service.execute({
      contextId: '5',
      placement: 'CRM_COMPANY_DETAIL_TAB',
    })

    expect(destinations).toEqual([])
  })
})
