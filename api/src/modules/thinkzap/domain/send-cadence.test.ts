import { describe, expect, it } from 'vitest'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import {
  CadenceSettings,
  CadenceState,
  cadencePolicyOf,
  hasPendingCadenceChange,
  isValidCadenceConfig,
} from './send-cadence'

const OFF: CadenceSettings = {
  cadenceEnabled: false,
  cadenceMaxMessages: null,
  cadenceWindowMinutes: null,
  cadencePauseEnabled: false,
  cadencePauseMinutes: null,
}

const ON: CadenceSettings = {
  cadenceEnabled: true,
  cadenceMaxMessages: 20,
  cadenceWindowMinutes: 1,
  cadencePauseEnabled: true,
  cadencePauseMinutes: 5,
}

describe('isValidCadenceConfig', () => {
  it('desligada não exige nada', () => {
    expect(isValidCadenceConfig(OFF)).toBe(true)
  })

  it('aceita N e D válidos com pausa', () => {
    expect(isValidCadenceConfig(ON)).toBe(true)
  })

  it('Valor inválido: N = 0 é recusado', () => {
    expect(isValidCadenceConfig({ ...ON, cadenceMaxMessages: 0 })).toBe(false)
  })

  it.each([null, -1, 1.5])('recusa D = %s', value => {
    expect(
      isValidCadenceConfig({
        ...ON,
        cadenceWindowMinutes: value,
      }),
    ).toBe(false)
  })

  it('Pausa ativada sem duração é recusada', () => {
    expect(isValidCadenceConfig({ ...ON, cadencePauseMinutes: null })).toBe(
      false,
    )
  })

  it('pausa desligada não exige P', () => {
    expect(
      isValidCadenceConfig({
        ...ON,
        cadencePauseEnabled: false,
        cadencePauseMinutes: null,
      }),
    ).toBe(true)
  })
})

describe('cadencePolicyOf', () => {
  it('linha oficial não tem cadência', () => {
    expect(
      cadencePolicyOf({
        provider: ConnectorProvider.HUBMESSAGE,
        lineKey: 'x',
        settings: ON,
      }),
    ).toBeNull()
  })

  it('Z-API sem lineKey não tem cadência', () => {
    expect(
      cadencePolicyOf({ provider: ConnectorProvider.ZAPI, settings: ON }),
    ).toBeNull()
  })

  it('Z-API ligada converte minutos em ms', () => {
    expect(
      cadencePolicyOf({
        provider: ConnectorProvider.ZAPI,
        lineKey: 'inst-1',
        settings: ON,
      }),
    ).toEqual({
      lineKey: 'inst-1',
      enabled: true,
      maxMessages: 20,
      windowMs: 60_000,
      pauseMs: 300_000,
    })
  })

  it('Z-API desligada continua com política (para snapshot e FIFO)', () => {
    expect(
      cadencePolicyOf({
        provider: ConnectorProvider.ZAPI,
        lineKey: 'inst-1',
        settings: OFF,
      }),
    ).toMatchObject({ lineKey: 'inst-1', enabled: false })
  })

  it('ligada mas inválida conta como desligada', () => {
    expect(
      cadencePolicyOf({
        provider: ConnectorProvider.ZAPI,
        lineKey: 'inst-1',
        settings: { ...ON, cadenceMaxMessages: null },
      })?.enabled,
    ).toBe(false)
  })

  it('pausa desligada dá pauseMs 0', () => {
    expect(
      cadencePolicyOf({
        provider: ConnectorProvider.ZAPI,
        lineKey: 'inst-1',
        settings: { ...ON, cadencePauseEnabled: false },
      })?.pauseMs,
    ).toBe(0)
  })
})

describe('hasPendingCadenceChange', () => {
  const policy = cadencePolicyOf({
    provider: ConnectorProvider.ZAPI,
    lineKey: 'inst-1',
    settings: ON,
  })!
  const state: CadenceState = {
    phase: 'window',
    count: 3,
    max: 20,
    windowEndsAt: 1,
    pauseUntil: null,
    snapshot: { maxMessages: 20, windowMs: 60_000, pauseMs: 300_000 },
  }

  it('sem diferença não há pendência', () => {
    expect(hasPendingCadenceChange(policy, state)).toBe(false)
  })

  it('N diferente do snapshot é pendência', () => {
    expect(hasPendingCadenceChange({ ...policy, maxMessages: 10 }, state)).toBe(
      true,
    )
  })

  it('desligar com janela aberta é pendência', () => {
    expect(hasPendingCadenceChange({ ...policy, enabled: false }, state)).toBe(
      true,
    )
  })

  it('sem janela nada fica pendente', () => {
    expect(
      hasPendingCadenceChange(
        { ...policy, maxMessages: 10 },
        { ...state, phase: 'idle', snapshot: null },
      ),
    ).toBe(false)
  })
})
