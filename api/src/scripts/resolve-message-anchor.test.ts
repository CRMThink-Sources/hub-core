import { describe, expect, it } from 'vitest'
import {
  findAnchorCollisions,
  resolveAnchor,
  type InstanceRow,
} from './resolve-message-anchor'

const row = (overrides: Partial<InstanceRow> = {}): InstanceRow => ({
  id: 'uuid-1',
  instanceId: 'Z-1',
  channelId: null,
  provider: 'ZAPI',
  ...overrides,
})

describe('resolveAnchor', () => {
  it('usa o instanceId para Z-API', () => {
    expect(resolveAnchor(row())).toBe('Z-1')
  })

  /** Conector ausente resolve Z-API, mesma regra do contexto de webhook. */
  it('usa o instanceId quando não há provider', () => {
    expect(resolveAnchor(row({ provider: null }))).toBe('Z-1')
  })

  it('usa o channelId para HubMessage', () => {
    expect(
      resolveAnchor(row({ provider: 'HUBMESSAGE', channelId: 'C-9' })),
    ).toBe('C-9')
  })

  /**
   * É o único caso que mantém o uuid antigo. Traduzir para o `instanceId` aqui
   * seria gravar uma âncora que o webhook da HubMessage nunca entrega — a
   * mensagem seguinte não casaria com o histórico.
   */
  it('devolve null para HubMessage sem channelId', () => {
    expect(
      resolveAnchor(row({ provider: 'HUBMESSAGE', channelId: null })),
    ).toBeNull()
  })

  it('trata channelId vazio como ausente', () => {
    expect(
      resolveAnchor(row({ provider: 'HUBMESSAGE', channelId: '' })),
    ).toBeNull()
  })

  it('trata instanceId vazio como ausente', () => {
    expect(resolveAnchor(row({ instanceId: '' }))).toBeNull()
  })

  /** A âncora não depende de existir item na SPA — ver decisão 8 do design. */
  it('resolve mesmo sem item correspondente na SPA', () => {
    expect(resolveAnchor(row({ instanceId: 'Z-ORFA' }))).toBe('Z-ORFA')
  })
})

describe('findAnchorCollisions', () => {
  it('não acusa colisão quando as âncoras são distintas', () => {
    const collisions = findAnchorCollisions([
      row({ id: 'u1', instanceId: 'Z-1' }),
      row({ id: 'u2', instanceId: 'Z-2' }),
    ])

    expect(collisions.size).toBe(0)
  })

  /**
   * O caso que aborta a migração: duas instâncias virando um escopo só de
   * idempotência permitiria mensagem duplicada no CRM.
   */
  it('acusa duas instâncias com o mesmo instanceId', () => {
    const collisions = findAnchorCollisions([
      row({ id: 'u1', instanceId: 'Z-1' }),
      row({ id: 'u2', instanceId: 'Z-1' }),
    ])

    expect(collisions.size).toBe(1)
    expect(collisions.get('Z-1')?.map(r => r.id)).toEqual(['u1', 'u2'])
  })

  it('acusa colisão entre canais de HubMessage', () => {
    const collisions = findAnchorCollisions([
      row({ id: 'u1', provider: 'HUBMESSAGE', channelId: 'C-9' }),
      row({ id: 'u2', provider: 'HUBMESSAGE', channelId: 'C-9' }),
    ])

    expect(collisions.get('C-9')).toHaveLength(2)
  })

  /**
   * Providers diferentes podem colidir: o `channelId` de um HubMessage pode, em
   * princípio, ser igual ao `instanceId` de um Z-API. A coluna é a mesma, então a
   * verificação tem que ser sobre a âncora, não por provider.
   */
  it('acusa colisão entre providers diferentes na mesma âncora', () => {
    const collisions = findAnchorCollisions([
      row({ id: 'u1', instanceId: 'X-1' }),
      row({ id: 'u2', provider: 'HUBMESSAGE', channelId: 'X-1' }),
    ])

    expect(collisions.get('X-1')).toHaveLength(2)
  })

  it('ignora instâncias sem âncora em vez de agrupá-las', () => {
    const collisions = findAnchorCollisions([
      row({ id: 'u1', provider: 'HUBMESSAGE', channelId: null }),
      row({ id: 'u2', provider: 'HUBMESSAGE', channelId: null }),
    ])

    expect(collisions.size).toBe(0)
  })

  it('devolve vazio para lista vazia', () => {
    expect(findAnchorCollisions([]).size).toBe(0)
  })
})
