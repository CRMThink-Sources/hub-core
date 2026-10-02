import { describe, expect, it, vi } from 'vitest'

import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { makeGetCrmContactName } from './get-crm-contact-name'

function makeClient(callMethod: ReturnType<typeof vi.fn>) {
  return { callMethod } as unknown as Pick<BitrixClient, 'callMethod'>
}

describe('makeGetCrmContactName', () => {
  it('lê item de SPA por crm.item.get e usa o title', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValue({ result: { item: { title: ' Proposta ACME ' } } })

    const name = await makeGetCrmContactName(makeClient(callMethod))({
      entity: 'DYNAMIC_1060',
      entityId: '1613',
    })

    expect(callMethod).toHaveBeenCalledWith('crm.item.get', {
      entityTypeId: 1060,
      id: 1613,
    })
    expect(name).toBe('Proposta ACME')
  })

  it('aceita SPA em minúsculas', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValue({ result: { item: { title: 'X' } } })

    await makeGetCrmContactName(makeClient(callMethod))({
      entity: 'dynamic_183',
      entityId: '9',
    })

    expect(callMethod).toHaveBeenCalledWith('crm.item.get', {
      entityTypeId: 183,
      id: 9,
    })
  })

  it('devolve null para item de SPA sem title', async () => {
    const callMethod = vi.fn().mockResolvedValue({ result: { item: {} } })

    const name = await makeGetCrmContactName(makeClient(callMethod))({
      entity: 'DYNAMIC_1060',
      entityId: '1613',
    })

    expect(name).toBeNull()
  })

  it('mantém crm.<entity>.get para contato', async () => {
    const callMethod = vi.fn().mockResolvedValue({
      result: { NAME: 'Maria', LAST_NAME: 'Souza' },
    })

    const name = await makeGetCrmContactName(makeClient(callMethod))({
      entity: 'contact',
      entityId: '42',
    })

    expect(callMethod).toHaveBeenCalledWith('crm.contact.get', { ID: 42 })
    expect(name).toBe('Maria Souza')
  })

  it('mantém crm.<entity>.get para negócio, usando o TITLE', async () => {
    const callMethod = vi
      .fn()
      .mockResolvedValue({ result: { TITLE: 'Negócio 1' } })

    const name = await makeGetCrmContactName(makeClient(callMethod))({
      entity: 'deal',
      entityId: '7',
    })

    expect(callMethod).toHaveBeenCalledWith('crm.deal.get', { ID: 7 })
    expect(name).toBe('Negócio 1')
  })
})
