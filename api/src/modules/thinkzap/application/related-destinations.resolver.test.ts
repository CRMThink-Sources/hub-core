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

/**
 * `getCrmItem` roteado por `entityTypeId:id`. Par não mapeado rejeita de
 * propósito: um vínculo resolvido para uma entidade que o teste não previu tem de
 * aparecer como falha, não como destino silenciosamente ausente.
 */
const routeCrmItems = (items: Record<string, ReturnType<typeof crmItem>>) =>
  vi.fn().mockImplementation((entityTypeId: number, id: string) => {
    const found = items[`${entityTypeId}:${id}`]
    if (found) return Promise.resolve(found)
    return Promise.reject(new Error(`unexpected(${entityTypeId},${id})`))
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

  it('includes the phone of the contact linked to the lead', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1:5': crmItem('5', 'Lead X', '5511111111111'),
        '3:20': crmItem('20', 'Maria', '5522222222222'),
      }),
      getLeadContactIds: vi.fn().mockResolvedValue(['20']),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_LEAD_DETAIL_TAB',
      '5',
    )

    expect(bitrix.getLeadContactIds).toHaveBeenCalledWith('5')
    expect(destinations).toEqual(
      expect.arrayContaining([
        { id: '20', label: 'Contato - Maria', phone: '5522222222222' },
      ]),
    )
  })

  it('includes every contact linked to the lead, plus the lead itself', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1:5': crmItem('5', 'Lead X', '5511111111111'),
        '3:20': crmItem('20', 'Maria', '5522222222222'),
        '3:30': crmItem('30', 'Joao', '5533333333333'),
      }),
      getLeadContactIds: vi.fn().mockResolvedValue(['20', '30']),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_LEAD_DETAIL_TAB',
      '5',
    )

    expect(destinations.map(d => d.phone).sort()).toEqual([
      '5511111111111',
      '5522222222222',
      '5533333333333',
    ])
  })

  it('falls back to the lead contactId when the linked-contacts call fails', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1:5': crmItem('5', 'Lead X', undefined, { contactId: 20 }),
        '3:20': crmItem('20', 'Maria', '5522222222222'),
      }),
      getLeadContactIds: vi.fn().mockRejectedValue(new Error('boom')),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_LEAD_DETAIL_TAB',
      '5',
    )

    expect(destinations).toEqual([
      { id: '20', label: 'Contato - Maria', phone: '5522222222222' },
    ])
  })

  it('falls back to the lead contactIds when no linked contact is returned', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1:5': crmItem('5', 'Lead X', undefined, { contactIds: [20, '30'] }),
        '3:20': crmItem('20', 'Maria', '5522222222222'),
        '3:30': crmItem('30', 'Joao', '5533333333333'),
      }),
      getLeadContactIds: vi.fn().mockResolvedValue([]),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_LEAD_DETAIL_TAB',
      '5',
    )

    expect(destinations.map(d => d.phone).sort()).toEqual([
      '5522222222222',
      '5533333333333',
    ])
  })

  it('includes the company linked to the lead and the contacts of that company', async () => {
    const getCrmItem = routeCrmItems({
      '1:5': crmItem('5', 'Lead X', undefined, { companyId: 7 }),
      '4:7': crmItem('7', 'Acme', '5544444444444', { contactIds: [100] }),
      '3:100': crmItem('100', 'Ana', '5555555555555'),
    })
    const bitrix = makeBitrix({ getCrmItem })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_LEAD_DETAIL_TAB',
      '5',
    )

    expect(destinations).toEqual(
      expect.arrayContaining([
        { id: '7', label: 'Empresa - Acme', phone: '5544444444444' },
        { id: '100', label: 'Contato - Ana', phone: '5555555555555' },
      ]),
    )
    // A empresa é buscada uma única vez (cache): serve tanto como destino
    // (telefone via `fm`) quanto como fonte dos `contactIds`.
    expect(
      getCrmItem.mock.calls.filter(
        ([entityTypeId, id]) => entityTypeId === 4 && id === '7',
      ),
    ).toHaveLength(1)
  })

  it('deduplicates a phone shared by the lead, its contact and its company', async () => {
    const shared = '5511000000000'
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1:5': crmItem('5', 'Lead X', shared, { companyId: 7 }),
        '3:20': crmItem('20', 'Maria', shared),
        '4:7': crmItem('7', 'Acme', shared),
      }),
      getLeadContactIds: vi.fn().mockResolvedValue(['20']),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_LEAD_DETAIL_TAB',
      '5',
    )

    expect(destinations).toEqual([
      { id: '5', label: 'Lead - Lead X', phone: shared },
    ])
  })

  it('resolves only the lead itself when it has no linked client', async () => {
    const getCrmItem = routeCrmItems({
      '1:5': crmItem('5', 'Lead X', '5511111111111'),
    })
    const bitrix = makeBitrix({ getCrmItem })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_LEAD_DETAIL_TAB',
      '5',
    )

    expect(destinations).toEqual([
      { id: '5', label: 'Lead - Lead X', phone: '5511111111111' },
    ])
    expect(
      getCrmItem.mock.calls.filter(([entityTypeId]) => entityTypeId === 4),
    ).toHaveLength(0)
  })

  it('keeps the remaining lead destinations when one linked contact fails to load', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1:5': crmItem('5', 'Lead X', '5511111111111'),
        '3:30': crmItem('30', 'Joao', '5533333333333'),
      }),
      getLeadContactIds: vi.fn().mockResolvedValue(['20', '30']),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_LEAD_DETAIL_TAB',
      '5',
    )

    expect(destinations.map(d => d.phone).sort()).toEqual([
      '5511111111111',
      '5533333333333',
    ])
  })

  it('rejects an unknown placement without calling the Bitrix API', async () => {
    const bitrix = makeBitrix({
      getCrmItem: vi.fn().mockResolvedValue(crmItem('1', 'X')),
    })

    await expect(
      resolveRelatedDestinations(bitrix as never, 'CRM_UNKNOWN_TAB', '1'),
    ).rejects.toThrow('Unsupported placement: CRM_UNKNOWN_TAB')

    expect(bitrix.getCrmItem).not.toHaveBeenCalled()
  })

  it('resolves entityTypeId from a dynamic SPA placement and returns its own phone', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1060:1617': crmItem('1617', 'Pedido 1617', '5511999999999'),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_DYNAMIC_1060_DETAIL_TAB',
      '1617',
    )

    expect(destinations.map(d => d.phone)).toEqual(['5511999999999'])
    expect(bitrix.getCrmItem).toHaveBeenCalledWith(1060, '1617')
  })

  it('returns no destinations when the dynamic SPA item has no phone', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1060:1617': crmItem('1617', 'Pedido 1617'),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_DYNAMIC_1060_DETAIL_TAB',
      '1617',
    )

    expect(destinations).toEqual([])
  })

  it('resolves a different dynamic entityTypeId the same way', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1142:42': crmItem('42', 'Contrato 42', '5511988888888'),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_DYNAMIC_1142_DETAIL_TAB',
      '42',
    )

    expect(destinations.map(d => d.phone)).toEqual(['5511988888888'])
    expect(bitrix.getCrmItem).toHaveBeenCalledWith(1142, '42')
  })

  it('includes the client contact and company linked to a dynamic SPA item', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1060:1617': crmItem('1617', 'Pedido 1617', undefined, {
          contactId: '10',
          companyId: '5',
        }),
        '3:10': crmItem('10', 'Cliente Principal', '5511111111111'),
        '4:5': crmItem('5', 'Empresa Cliente', '5522222222222'),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_DYNAMIC_1060_DETAIL_TAB',
      '1617',
    )

    expect(destinations.map(d => d.phone).sort()).toEqual([
      '5511111111111',
      '5522222222222',
    ])
    expect(bitrix.getCrmItem).toHaveBeenCalledWith(3, '10')
    expect(bitrix.getCrmItem).toHaveBeenCalledWith(4, '5')
  })

  it("includes the client company's other contacts for a dynamic SPA item", async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '1060:1617': crmItem('1617', 'Pedido 1617', undefined, {
          companyId: '5',
        }),
        '4:5': crmItem('5', 'Empresa Cliente', undefined, {
          contactIds: [20],
        }),
        '3:20': crmItem('20', 'Contato da Empresa', '5533333333333'),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_DYNAMIC_1060_DETAIL_TAB',
      '1617',
    )

    expect(destinations.map(d => d.phone)).toEqual(['5533333333333'])
  })
})

describe('resolveRelatedDestinations — CRM_CONTACT_DETAIL_TAB', () => {
  it('resolves only the contact phones even when linked to several companies', async () => {
    const getCrmItem = routeCrmItems({
      '3:42': crmItem('42', 'João', '5511111111111,5522222222222', {
        companyId: 7,
        companyIds: [7, 8],
      }),
      '4:7': crmItem('7', 'Acme', '5533333333333', { contactIds: [42, 100] }),
      '4:8': crmItem('8', 'Beta', '5544444444444', { contactIds: [42, 101] }),
      '3:100': crmItem('100', 'Ana', '5555555555555'),
      '3:101': crmItem('101', 'Bia', '5566666666666'),
    })
    const bitrix = makeBitrix({ getCrmItem })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_CONTACT_DETAIL_TAB',
      '42',
    )

    expect(destinations).toEqual([
      { id: '42', label: 'Contato - João', phone: '5511111111111' },
      { id: '42', label: 'Contato - João', phone: '5522222222222' },
    ])
    expect(
      getCrmItem.mock.calls.filter(([entityTypeId]) => entityTypeId === 4),
    ).toHaveLength(0)
    expect(bitrix.getCompanyContactIds).not.toHaveBeenCalled()
  })

  it('does not include the lead linked to the contact', async () => {
    const getCrmItem = routeCrmItems({
      '3:42': crmItem('42', 'João', '5511111111111', { leadId: 9 }),
      '1:9': crmItem('9', 'Lead X', '5577777777777'),
    })
    const bitrix = makeBitrix({ getCrmItem })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_CONTACT_DETAIL_TAB',
      '42',
    )

    expect(destinations.map(d => d.phone)).toEqual(['5511111111111'])
    expect(
      getCrmItem.mock.calls.filter(([entityTypeId]) => entityTypeId === 1),
    ).toHaveLength(0)
  })

  it('returns no destinations when the contact has no phone', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '3:42': crmItem('42', 'João', undefined, { companyId: 7 }),
        '4:7': crmItem('7', 'Acme', '5533333333333', { contactIds: [100] }),
        '3:100': crmItem('100', 'Ana', '5555555555555'),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_CONTACT_DETAIL_TAB',
      '42',
    )

    expect(destinations).toEqual([])
  })

  it('lists a phone repeated on the contact only once', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '3:42': crmItem('42', 'João', undefined, {
          fm: [
            { typeId: 'PHONE', value: '5511111111111' },
            { typeId: 'PHONE', value: '5511111111111' },
          ],
        }),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_CONTACT_DETAIL_TAB',
      '42',
    )

    expect(destinations).toEqual([
      { id: '42', label: 'Contato - João', phone: '5511111111111' },
    ])
  })
})

describe('resolveRelatedDestinations — CRM_COMPANY_DETAIL_TAB', () => {
  it('includes the company phone and the phones of its linked contacts', async () => {
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '4:5': crmItem('5', 'Acme', '5531111111111', { contactIds: [100, 101] }),
        '3:100': crmItem('100', 'Ana', '5555555555555'),
        '3:101': crmItem('101', 'Bia', '5566666666666'),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_COMPANY_DETAIL_TAB',
      '5',
    )

    expect(destinations).toHaveLength(3)
    expect(destinations).toEqual(
      expect.arrayContaining([
        { id: '5', label: 'Empresa - Acme', phone: '5531111111111' },
        { id: '100', label: 'Contato - Ana', phone: '5555555555555' },
        { id: '101', label: 'Contato - Bia', phone: '5566666666666' },
      ]),
    )
  })

  it('lists a phone shared by the company and a contact only once', async () => {
    const shared = '5531111111111'
    const bitrix = makeBitrix({
      getCrmItem: routeCrmItems({
        '4:5': crmItem('5', 'Acme', shared, { contactIds: [100] }),
        '3:100': crmItem('100', 'Ana', shared),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_COMPANY_DETAIL_TAB',
      '5',
    )

    expect(destinations.filter(d => d.phone === shared)).toHaveLength(1)
  })

  it('keeps the other destinations when one linked contact fails to load', async () => {
    const bitrix = makeBitrix({
      // `3:101` fora do mapa: `routeCrmItems` rejeita a leitura desse contato.
      getCrmItem: routeCrmItems({
        '4:5': crmItem('5', 'Acme', '5531111111111', { contactIds: [100, 101] }),
        '3:100': crmItem('100', 'Ana', '5555555555555'),
      }),
    })

    const { destinations } = await resolveRelatedDestinations(
      bitrix as never,
      'CRM_COMPANY_DETAIL_TAB',
      '5',
    )

    expect(destinations.map(d => d.phone).sort()).toEqual([
      '5531111111111',
      '5555555555555',
    ])
  })
})
