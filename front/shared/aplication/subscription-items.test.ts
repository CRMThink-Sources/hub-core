import { describe, expect, it } from 'vitest'
import {
  countActiveLines,
  listSendableLines,
  listSubscriptionLines,
} from './subscription-items'
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

  /**
   * Uma instalação cobrada por dois planos tem uma assinatura por plano na SPA, as
   * duas com o mesmo id no gateway. A lista atravessa as irmãs: cada linha tem um pai
   * só, então nada duplica, e cada uma carrega o nome do plano que a cobra.
   */
  it('lista as linhas das assinaturas irmãs do mesmo contrato', () => {
    const linhas = listSubscriptionLines([
      {
        ...sub('s1', 'active', [item('i1', 'active', zapi)], 'Web'),
        gatewayId: 'sub_1',
      },
      {
        ...sub('s2', 'active', [item('i2', 'active', hub)], 'Oficial'),
        gatewayId: 'sub_1',
      },
    ])

    expect(
      linhas.map(linha => [linha.id, linha.planName, linha.subscriptionId]),
    ).toEqual([
      ['i1', 'Web', 's1'],
      ['i2', 'Oficial', 's2'],
    ])
  })
})

describe('listSendableLines', () => {
  const now = new Date('2026-07-15T12:00:00.000Z')

  /** Assinatura com janela explícita — os casos de trial dependem dela. */
  const subUntil = (
    id: string,
    status: SpaSubscriptionStatus,
    currentPeriodEnd: string,
    items: SubscriptionItemView[],
  ): SubscriptionView => ({ ...sub(id, status, items), currentPeriodEnd })

  it('devolve lista vazia para payload ausente', () => {
    expect(listSendableLines(undefined, now)).toEqual([])
    expect(listSendableLines(null, now)).toEqual([])
    expect(listSendableLines([], now)).toEqual([])
  })

  it('oferta a linha ativa de assinatura paga', () => {
    const linhas = listSendableLines(
      [sub('s1', 'active', [item('i1', 'active', zapi, 'Comercial')])],
      now,
    )

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

  it('oferta a linha de trial dentro da janela', () => {
    const linhas = listSendableLines(
      [
        subUntil('s1', 'trialing', '2026-07-20T00:00:00.000Z', [
          item('i1', 'active', hub),
        ]),
      ],
      now,
    )

    expect(linhas.map(l => l.id)).toEqual(['i1'])
  })

  it('não oferta a linha de trial fora da janela', () => {
    const linhas = listSendableLines(
      [
        subUntil('s1', 'trialing', '2026-07-10T00:00:00.000Z', [
          item('i1', 'active', zapi),
        ]),
      ],
      now,
    )

    expect(linhas).toEqual([])
  })

  it('oferta no último instante da janela do trial', () => {
    const fim = '2026-07-15T12:00:00.000Z'
    const linhas = listSendableLines(
      [subUntil('s1', 'trialing', fim, [item('i1', 'active', zapi)])],
      new Date(fim),
    )

    expect(linhas.map(l => l.id)).toEqual(['i1'])
  })

  it.each(['cancelled', 'past_due'] as const)(
    'não oferta linha de assinatura %s',
    (status: SpaSubscriptionStatus) => {
      expect(
        listSendableLines(
          [sub('s1', status, [item('i1', 'active', zapi)])],
          now,
        ),
      ).toEqual([])
    },
  )

  it('não oferta linha de assinatura com status desconhecido', () => {
    const desconhecida = {
      ...sub('s1', 'active', [item('i1', 'active', zapi)]),
      status: 'paused' as unknown as SpaSubscriptionStatus,
    }

    expect(listSendableLines([desconhecida], now)).toEqual([])
  })

  it('não oferta item cancelado dentro de assinatura viva', () => {
    const linhas = listSendableLines(
      [
        sub('s1', 'active', [
          item('i1', 'active', zapi),
          item('i2', 'cancelled', zapi),
        ]),
      ],
      now,
    )

    expect(linhas.map(l => l.id)).toEqual(['i1'])
  })

  it('não oferta item de cobrança sem conector', () => {
    const linhas = listSendableLines(
      [
        sub('s1', 'active', [
          item('i1', 'active', none),
          item('i2', 'active', hub),
        ]),
      ],
      now,
    )

    expect(linhas.map(l => l.id)).toEqual(['i2'])
  })

  it('achata as linhas ofertáveis de várias assinaturas habilitadas', () => {
    const linhas = listSendableLines(
      [
        sub('s1', 'active', [item('i1', 'active', zapi)]),
        subUntil('s2', 'trialing', '2026-07-20T00:00:00.000Z', [
          item('i2', 'active', hub),
        ]),
        sub('s3', 'cancelled', [item('i3', 'active', zapi)]),
      ],
      now,
    )

    expect(linhas.map(l => l.id)).toEqual(['i1', 'i2'])
  })
})

describe('listSubscriptionLines mantém o que a tela de conexões precisa ver', () => {
  const now = new Date('2026-07-15T12:00:00.000Z')

  /**
   * Regressão: `listSendableLines` não pode ter estreitado a lista da tela. Linha
   * bloqueada e item cancelado continuam visíveis lá — o cliente tem que ver o que
   * tinha e por que parou.
   */
  it('lista linha de trial vencido e item cancelado que o widget não oferta', () => {
    const assinaturas: SubscriptionView[] = [
      {
        ...sub('s1', 'trialing', [
          item('i1', 'active', zapi),
          item('i2', 'cancelled', zapi),
        ]),
        currentPeriodEnd: '2026-07-10T00:00:00.000Z',
      },
    ]

    expect(listSubscriptionLines(assinaturas).map(l => l.id)).toEqual([
      'i1',
      'i2',
    ])
    expect(listSendableLines(assinaturas, now)).toEqual([])
  })
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
