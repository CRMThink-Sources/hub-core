import { describe, expect, it } from 'vitest'
import { countActiveLines, listSubscriptionLines } from './subscription-items'
import type {
  SubscriptionItemMetadataView,
  SubscriptionItemView,
  SubscriptionView,
} from './aplication-context'
import type { SpaSubscriptionStatus } from '@/shared/billing/derive-subscription-state'

const item = (
  id: string,
  status: SubscriptionItemView['status'],
  metadata: SubscriptionItemMetadataView,
  name = `Linha ${id}`,
): SubscriptionItemView => ({ id, name, status, metadata })

const sub = (
  id: string,
  status: SpaSubscriptionStatus,
  items: SubscriptionItemView[],
  planName = 'Conector WhatsApp',
): SubscriptionView => ({
  id,
  name: `Assinatura ${id}`,
  status,
  currentPeriodStart: '2026-07-01T00:00:00.000Z',
  currentPeriodEnd: '2026-08-01T00:00:00.000Z',
  plan: { id: 'plan-1', name: planName, amount: 9900 },
  items,
})

const zapi: SubscriptionItemMetadataView = {
  provider: 'ZAPI',
  zApiInstanceId: 'Z-1',
}
const hub: SubscriptionItemMetadataView = {
  provider: 'HUBMESSAGE',
  hubmessageChannelId: 'C-9',
  wabaId: 'W-9',
}
const none: SubscriptionItemMetadataView = { provider: 'NONE' }

describe('listSubscriptionLines', () => {
  it('devolve lista vazia para payload ausente', () => {
    expect(listSubscriptionLines(undefined)).toEqual([])
    expect(listSubscriptionLines(null)).toEqual([])
    expect(listSubscriptionLines([])).toEqual([])
  })

  it('mapeia o item para a linha com plano e referência do provider', () => {
    const linhas = listSubscriptionLines([
      sub('s1', 'active', [item('i1', 'active', zapi, 'Comercial')]),
    ])

    expect(linhas).toEqual([
      {
        id: 'i1',
        name: 'Comercial',
        status: 'active',
        provider: 'ZAPI',
        subscriptionId: 's1',
        planName: 'Conector WhatsApp',
        providerRef: 'Z-1',
      },
    ])
  })

  it('usa o channelId como referência de linha do WhatsApp Oficial', () => {
    const [linha] = listSubscriptionLines([
      sub('s1', 'active', [item('i1', 'active', hub)]),
    ])

    expect(linha).toMatchObject({ provider: 'HUBMESSAGE', providerRef: 'C-9' })
  })

  it('deixa a referência nula quando o item não tem provider', () => {
    const [linha] = listSubscriptionLines([
      sub('s1', 'active', [item('i1', 'active', none)]),
    ])

    expect(linha).toMatchObject({ provider: 'NONE', providerRef: null })
  })

  it('achata itens de várias assinaturas vivas', () => {
    const linhas = listSubscriptionLines([
      sub('s1', 'active', [
        item('i1', 'active', zapi),
        item('i2', 'active', zapi),
      ]),
      sub('s2', 'trialing', [item('i3', 'active', hub)]),
    ])

    expect(linhas.map(l => l.id)).toEqual(['i1', 'i2', 'i3'])
    expect(linhas.map(l => l.subscriptionId)).toEqual(['s1', 's1', 's2'])
  })

  it('mantém item cancelado de assinatura viva, com o próprio status', () => {
    const linhas = listSubscriptionLines([
      sub('s1', 'active', [
        item('i1', 'active', zapi),
        item('i2', 'cancelled', zapi),
      ]),
    ])

    expect(linhas.map(l => [l.id, l.status])).toEqual([
      ['i1', 'active'],
      ['i2', 'cancelled'],
    ])
  })

  it('descarta itens de assinatura cancelada', () => {
    const linhas = listSubscriptionLines([
      sub('s1', 'active', [item('i1', 'active', zapi)]),
      sub('s2', 'cancelled', [
        item('i2', 'active', zapi),
        item('i3', 'active', hub),
      ]),
    ])

    expect(linhas.map(l => l.id)).toEqual(['i1'])
  })

  it('devolve lista vazia quando a assinatura viva não tem item', () => {
    expect(listSubscriptionLines([sub('s1', 'active', [])])).toEqual([])
  })

  it.each(['active', 'past_due', 'trialing'] as const)(
    'inclui itens de assinatura %s',
    (status: SpaSubscriptionStatus) => {
      expect(
        listSubscriptionLines([
          sub('s1', status, [item('i1', 'active', zapi)]),
        ]),
      ).toHaveLength(1)
    },
  )
})

describe('countActiveLines', () => {
  it('conta só as linhas ativas', () => {
    const linhas = listSubscriptionLines([
      sub('s1', 'active', [
        item('i1', 'active', zapi),
        item('i2', 'cancelled', zapi),
        item('i3', 'active', hub),
      ]),
    ])

    expect(countActiveLines(linhas)).toBe(2)
  })

  it('conta zero para lista vazia', () => {
    expect(countActiveLines([])).toBe(0)
  })
})
