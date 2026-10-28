import { describe, expect, it, vi } from 'vitest'
import { env } from '@/config/env'
import { BITRIX_SPA_CLIENT_FIELDS } from '@/shared/domain/config/bitrix.env'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { findAplicationSpaItems } from './find-aplication-spa-items'

const DOMAIN = BITRIX_SPA_CLIENT_FIELDS.DOMAIN

const respondingWith = (items: unknown[]) =>
  ({
    listCrmItems: vi.fn().mockResolvedValue({ result: { items } }),
  }) as unknown as BitrixClient & { listCrmItems: ReturnType<typeof vi.fn> }

describe('findAplicationSpaItems', () => {
  it('filtra pelo app code e pelos domínios normalizados, na SPA de aplicação', async () => {
    const bitrix = respondingWith([])

    await findAplicationSpaItems(bitrix, 'crmthink.thinkzap', [
      ' Acme.Bitrix24.com.br ',
      'acme.bitrix24.com.br',
    ])

    expect(bitrix.listCrmItems).toHaveBeenCalledWith(
      env.payments.spa.aplicationEntityType,
      {
        [BITRIX_SPA_CLIENT_FIELDS.APP_CODE]: 'crmthink.thinkzap',
        [`@${DOMAIN}`]: ['acme.bitrix24.com.br'],
      },
      { select: ['id', DOMAIN] },
    )
  })

  it('domínio sem item não entra no Map', async () => {
    const items = await findAplicationSpaItems(
      respondingWith([]),
      'crmthink.thinkzap',
      ['acme.bitrix24.com.br'],
    )

    expect(items.get('acme.bitrix24.com.br')).toBeUndefined()
  })

  it('um item: devolve o id como string', async () => {
    const items = await findAplicationSpaItems(
      respondingWith([{ id: 512, [DOMAIN]: 'ACME.bitrix24.com.br' }]),
      'crmthink.thinkzap',
      ['acme.bitrix24.com.br'],
    )

    expect(items.get('acme.bitrix24.com.br')).toEqual(['512'])
  })

  it('duplicados: devolve todos, do menor id para o maior', async () => {
    const items = await findAplicationSpaItems(
      respondingWith([
        { id: 900, [DOMAIN]: 'acme.bitrix24.com.br' },
        { id: 512, [DOMAIN]: 'acme.bitrix24.com.br' },
      ]),
      'crmthink.thinkzap',
      ['acme.bitrix24.com.br'],
    )

    expect(items.get('acme.bitrix24.com.br')).toEqual(['512', '900'])
  })

  it('fatia os domínios em lotes de 50', async () => {
    const bitrix = respondingWith([])
    const domains = Array.from({ length: 60 }, (_, i) => `d${i}.bitrix24.com`)

    await findAplicationSpaItems(bitrix, 'crmthink.thinkzap', domains)

    expect(bitrix.listCrmItems).toHaveBeenCalledTimes(2)
  })

  it('segue o `next` até a última página', async () => {
    const listCrmItems = vi
      .fn()
      .mockResolvedValueOnce({
        result: { items: [{ id: 1, [DOMAIN]: 'a.bitrix24.com' }] },
        next: 50,
      })
      .mockResolvedValueOnce({
        result: { items: [{ id: 2, [DOMAIN]: 'a.bitrix24.com' }] },
      })
    const bitrix = { listCrmItems } as unknown as BitrixClient

    const items = await findAplicationSpaItems(bitrix, 'crmthink.thinkzap', [
      'a.bitrix24.com',
    ])

    expect(listCrmItems).toHaveBeenCalledTimes(2)
    expect(listCrmItems.mock.calls[1]?.[2]).toEqual({
      select: ['id', DOMAIN],
      start: 50,
    })
    expect(items.get('a.bitrix24.com')).toEqual(['1', '2'])
  })

  it('propaga a falha do Bitrix', async () => {
    const bitrix = {
      listCrmItems: vi.fn().mockRejectedValue(new Error('bitrix fora')),
    } as unknown as BitrixClient

    await expect(
      findAplicationSpaItems(bitrix, 'crmthink.thinkzap', ['a.bitrix24.com']),
    ).rejects.toThrow('bitrix fora')
  })
})
