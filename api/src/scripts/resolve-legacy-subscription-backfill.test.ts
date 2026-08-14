import { describe, expect, it } from 'vitest'
import { Plan } from '@/modules/application/domain/entities/plan'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { DEFAULT_CONNECTOR_SETTINGS } from '@/modules/thinkzap/domain/value-objects/connector-settings'
import {
  LegacyInstanceRow,
  mapLegacyStatus,
  matchExistingItems,
  reportQuantityDivergence,
  resolveInstanceMetadata,
  resolvePlanByProvider,
} from './resolve-legacy-subscription-backfill'

const instance = (
  overrides: Partial<LegacyInstanceRow> = {},
): LegacyInstanceRow => ({
  id: 'uuid-1',
  instanceId: 'zapi-instance',
  zApiToken: 'zapi-token',
  channelId: null,
  wabaId: null,
  vinculatedChannel: null,
  ...overrides,
})

const plan = (overrides: Partial<Plan> = {}): Plan =>
  ({
    id: '1',
    name: 'Plano',
    amount: 4990,
    interval: 'monthly',
    active: true,
    provider: 'ZAPI',
    product: { id: '1', name: 'ThinkZap' },
    ...overrides,
  }) as Plan

const item = (
  metadata: SubscriptionItem['metadata'],
  id = '100',
): SubscriptionItem => ({
  id,
  name: 'Linha',
  subscription: '10',
  status: 'active',
  metadata,
  settings: DEFAULT_CONNECTOR_SETTINGS,
  vinculatedChannel: null,
})

describe('mapLegacyStatus', () => {
  it('espelha ACTIVE e TRIALING preservando o estado', () => {
    expect(mapLegacyStatus('ACTIVE')).toBe('active')
    expect(mapLegacyStatus('TRIALING')).toBe('trialing')
  })

  /**
   * É o guarda que impede o backfill de destravar linha de inadimplente. Se isto
   * devolver status para `PAST_DUE`, o script espelha cobrança que não fechou.
   */
  it('recusa todo status que não é ACTIVE nem TRIALING', () => {
    expect(mapLegacyStatus('PAST_DUE')).toBeNull()
    expect(mapLegacyStatus('CANCELLED')).toBeNull()
    expect(mapLegacyStatus('INCOMPLETE')).toBeNull()
    expect(mapLegacyStatus('INCOMPLETE_EXPIRED')).toBeNull()
  })

  /** Mapa explícito, não `toLowerCase()`: caixa errada é valor desconhecido. */
  it('não deriva status por transformação de texto', () => {
    expect(mapLegacyStatus('active')).toBeNull()
    expect(mapLegacyStatus('Active')).toBeNull()
    expect(mapLegacyStatus('')).toBeNull()
  })
})

describe('resolveInstanceMetadata', () => {
  it('deriva ZAPI do par id + token', () => {
    expect(resolveInstanceMetadata(instance())).toEqual({
      provider: 'ZAPI',
      zApiInstanceId: 'zapi-instance',
      zApiInstanceToken: 'zapi-token',
    })
  })

  it('deriva HUBMESSAGE do canal, com a WABA quando houver', () => {
    expect(
      resolveInstanceMetadata(
        instance({ channelId: 'canal-1', wabaId: 'waba-1' }),
      ),
    ).toEqual({
      provider: 'HUBMESSAGE',
      hubmessageChannelId: 'canal-1',
      wabaId: 'waba-1',
    })
  })

  /**
   * A WABA só existe depois do embedded signup. Exigi-la deixaria de fora
   * exatamente as linhas oficiais que ainda não conectaram o número na Meta.
   */
  it('aceita HUBMESSAGE sem WABA, omitindo a chave', () => {
    const metadata = resolveInstanceMetadata(instance({ channelId: 'canal-1' }))

    expect(metadata).toEqual({
      provider: 'HUBMESSAGE',
      hubmessageChannelId: 'canal-1',
    })
    expect(metadata).not.toHaveProperty('wabaId')
  })

  /** O canal é o discriminador: instância HubMessage não vira item Z-API. */
  it('prefere o canal quando a instância carrega as duas credenciais', () => {
    expect(
      resolveInstanceMetadata(instance({ channelId: 'canal-1' })),
    ).toMatchObject({ provider: 'HUBMESSAGE' })
  })

  it('recusa par da Z-API incompleto', () => {
    expect(resolveInstanceMetadata(instance({ zApiToken: null }))).toBeNull()
    expect(resolveInstanceMetadata(instance({ instanceId: '' }))).toBeNull()
  })

  it('recusa instância sem credencial nenhuma', () => {
    expect(
      resolveInstanceMetadata(
        instance({ instanceId: '', zApiToken: null, channelId: null }),
      ),
    ).toBeNull()
  })
})

describe('resolvePlanByProvider', () => {
  it('resolve um plano ativo por provider em uso', () => {
    const result = resolvePlanByProvider(
      [
        plan({ id: '1', provider: 'ZAPI' }),
        plan({ id: '2', provider: 'HUBMESSAGE' }),
      ],
      ['ZAPI', 'HUBMESSAGE'],
    )

    expect(result).toEqual({
      ok: true,
      planIdByProvider: { ZAPI: '1', HUBMESSAGE: '2' },
    })
  })

  /**
   * Validar contra os providers **usados**, não contra os dois possíveis: catálogo
   * sem plano oficial não pode bloquear um backfill 100% Z-API.
   */
  it('não exige plano de provider que não está em uso', () => {
    const result = resolvePlanByProvider([plan({ id: '1' })], ['ZAPI'])

    expect(result).toMatchObject({ ok: true })
  })

  it('reporta provider em uso sem plano candidato', () => {
    const result = resolvePlanByProvider([plan({ id: '1' })], ['HUBMESSAGE'])

    expect(result).toEqual({
      ok: false,
      problems: [{ kind: 'missing', provider: 'HUBMESSAGE' }],
    })
  })

  /**
   * Nunca "pega o primeiro": dois planos ativos do mesmo provider têm valores
   * diferentes, e escolher por ordem de retorno cobraria o errado em silêncio.
   */
  it('reporta ambiguidade com os ids candidatos', () => {
    const result = resolvePlanByProvider(
      [plan({ id: '1' }), plan({ id: '2' })],
      ['ZAPI'],
    )

    expect(result).toEqual({
      ok: false,
      problems: [
        { kind: 'ambiguous', provider: 'ZAPI', candidateIds: ['1', '2'] },
      ],
    })
  })

  it('ignora plano inativo e plano sem provider', () => {
    const result = resolvePlanByProvider(
      [
        plan({ id: '1' }),
        plan({ id: '2', active: false }),
        plan({ id: '3', provider: undefined }),
      ],
      ['ZAPI'],
    )

    expect(result).toEqual({
      ok: true,
      planIdByProvider: { ZAPI: '1', HUBMESSAGE: undefined },
    })
  })
})

describe('matchExistingItems', () => {
  it('separa instância já espelhada de instância a criar', () => {
    const match = matchExistingItems(
      [
        instance({ id: 'a', instanceId: 'ja-existe' }),
        instance({ id: 'b', instanceId: 'falta' }),
      ],
      [
        item({
          provider: 'ZAPI',
          zApiInstanceId: 'ja-existe',
          zApiInstanceToken: 'token',
        }),
      ],
    )

    expect(match.alreadyPresent.map(row => row.id)).toEqual(['a'])
    expect(match.missing.map(row => row.instance.id)).toEqual(['b'])
    expect(match.withoutCredential).toEqual([])
  })

  it('pareia linha HubMessage pelo canal, ignorando a WABA', () => {
    const match = matchExistingItems(
      [instance({ channelId: 'canal-1', wabaId: 'waba-nova' })],
      [item({ provider: 'HUBMESSAGE', hubmessageChannelId: 'canal-1' })],
    )

    expect(match.alreadyPresent).toHaveLength(1)
    expect(match.missing).toEqual([])
  })

  /**
   * A chave carrega o provider justamente para isto: id de instância Z-API e id de
   * canal HubMessage podem coincidir como texto, e a colisão pararia a criação de
   * um item legítimo.
   */
  it('não confunde credencial de providers diferentes com o mesmo texto', () => {
    const match = matchExistingItems(
      [instance({ channelId: 'mesmo-id' })],
      [
        item({
          provider: 'ZAPI',
          zApiInstanceId: 'mesmo-id',
          zApiInstanceToken: 'token',
        }),
      ],
    )

    expect(match.missing).toHaveLength(1)
    expect(match.alreadyPresent).toEqual([])
  })

  it('separa instância sem credencial completa', () => {
    const match = matchExistingItems(
      [instance({ id: 'c', instanceId: '', zApiToken: null })],
      [],
    )

    expect(match.withoutCredential.map(row => row.id)).toEqual(['c'])
    expect(match.missing).toEqual([])
  })

  /** Item `NONE` não tem credencial, então não pode parear com instância nenhuma. */
  it('ignora item de cobrança sem conector ao parear', () => {
    const match = matchExistingItems([instance()], [item({ provider: 'NONE' })])

    expect(match.missing).toHaveLength(1)
  })
})

describe('reportQuantityDivergence', () => {
  it('silencia quando contrato e instâncias batem', () => {
    expect(reportQuantityDivergence(2, 2)).toBeNull()
  })

  it('reporta contrato maior que o provisionado', () => {
    expect(reportQuantityDivergence(3, 2)).toContain('3 conector(es)')
  })

  it('reporta contrato menor que o provisionado', () => {
    expect(reportQuantityDivergence(1, 2)).toContain('2 instância(s)')
  })
})
