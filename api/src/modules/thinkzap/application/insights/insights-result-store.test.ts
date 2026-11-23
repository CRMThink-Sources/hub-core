import { describe, expect, it } from 'vitest'
import { MemoryInsightsKv } from '@/modules/thinkzap/infra/insights/memory-insights-kv'
import { makeInsightsKeys } from './insights-keys'
import {
  DASHBOARD_TTL_MS,
  InsightsResultStore,
  MAX_COMPUTE_MS,
  STALE_MAX_MS,
  TODAY_TTL_MS,
} from './insights-result-store'

function setup(env = 'bull') {
  let now = 1_000_000
  const clock = () => now
  const kv = new MemoryInsightsKv(clock)
  const store = new InsightsResultStore({
    kv,
    keys: makeInsightsKeys(env),
    now: clock,
  })
  return {
    kv,
    store,
    advance: (ms: number) => {
      now += ms
    },
  }
}

describe('InsightsResultStore — resultado', () => {
  it('devolve o resultado fresco dentro da validade', async () => {
    const { store, advance } = setup()
    await store.setResult('a', 'dashboard', 'h', { n: 1 }, 0)
    advance(DASHBOARD_TTL_MS - 1)
    expect(await store.getResult('a', 'dashboard', 'h')).toMatchObject({
      value: { n: 1 },
      fresh: true,
    })
  })

  it('serve vencido (stale) até 30 min depois da validade e depois some', async () => {
    const { store, advance } = setup()
    await store.setResult('a', 'dashboard', 'h', 'v', 0)
    advance(DASHBOARD_TTL_MS + 10 * 60_000)
    expect(await store.getResult('a', 'dashboard', 'h')).toMatchObject({
      value: 'v',
      fresh: false,
    })
    advance(STALE_MAX_MS)
    expect(await store.getResult('a', 'dashboard', 'h')).toBeNull()
  })

  it('o "Agora" vale 1 min; o Desempenho, 5', async () => {
    const { store, advance } = setup()
    await store.setResult('a', 'today', 'h', 't', 0)
    await store.setResult('a', 'dashboard', 'h', 'd', 0)
    advance(TODAY_TTL_MS + 1)
    expect((await store.getResult('a', 'today', 'h'))?.fresh).toBe(false)
    expect((await store.getResult('a', 'dashboard', 'h'))?.fresh).toBe(true)
  })

  it('separa por app, tipo e consulta', async () => {
    const { store } = setup()
    await store.setResult('a', 'dashboard', 'h1', 'x', 0)
    expect(await store.getResult('b', 'dashboard', 'h1')).toBeNull()
    expect(await store.getResult('a', 'today', 'h1')).toBeNull()
    expect(await store.getResult('a', 'dashboard', 'h2')).toBeNull()
  })

  it('descarta a gravação quando o app foi invalidado durante o cálculo', async () => {
    const { store } = setup()
    const gen = await store.getGeneration('a')
    await store.invalidateApp('a')
    expect(await store.setResult('a', 'dashboard', 'h', 'velho', gen)).toBe(
      false,
    )
    expect(await store.getResult('a', 'dashboard', 'h')).toBeNull()
    expect(
      await store.setResult(
        'a',
        'dashboard',
        'h',
        'novo',
        await store.getGeneration('a'),
      ),
    ).toBe(true)
  })

  it('a invalidação apaga resultado, estado e sessões por dia, só do app e do ambiente', async () => {
    const { store, kv } = setup('bull')
    const other = makeInsightsKeys('staging')
    await store.setResult('a', 'dashboard', 'h', 'x', 0)
    await store.setResult('b', 'dashboard', 'h', 'y', 0)
    await store.markComputing('a', 'today', 'h')
    await kv.set(makeInsightsKeys('bull').day('a', '2026-11-01'), '[]')
    await kv.set(other.result('a', 'dashboard', 'h'), 'staging')

    await store.invalidateApp('a')

    expect(await store.getResult('a', 'dashboard', 'h')).toBeNull()
    expect(await store.getState('a', 'today', 'h')).toBeNull()
    expect(
      await kv.get(makeInsightsKeys('bull').day('a', '2026-11-01')),
    ).toBeNull()
    // Outro app e outro ambiente seguem intactos.
    expect(await store.getResult('b', 'dashboard', 'h')).not.toBeNull()
    expect(await kv.get(other.result('a', 'dashboard', 'h'))).toBe('staging')
  })

  it('ignora um valor corrompido em vez de quebrar a leitura', async () => {
    const { store, kv } = setup()
    await kv.set(
      makeInsightsKeys('bull').result('a', 'dashboard', 'h'),
      '{ruim',
    )
    expect(await store.getResult('a', 'dashboard', 'h')).toBeNull()
  })
})

describe('InsightsResultStore — estado do cálculo', () => {
  it('marca, lê e limpa o "calculando"', async () => {
    const { store } = setup()
    expect(await store.getState('a', 'dashboard', 'h')).toBeNull()
    const s = await store.markComputing('a', 'dashboard', 'h')
    expect(s).toEqual({ status: 'computing', startedAt: 1_000_000 })
    expect(await store.getState('a', 'dashboard', 'h')).toEqual(s)
    await store.clearState('a', 'dashboard', 'h')
    expect(await store.getState('a', 'dashboard', 'h')).toBeNull()
  })

  it('o "calculando" expira sozinho depois do prazo máximo', async () => {
    const { store, advance } = setup()
    await store.markComputing('a', 'dashboard', 'h')
    advance(MAX_COMPUTE_MS + 60_001)
    expect(await store.getState('a', 'dashboard', 'h')).toBeNull()
  })

  it('registra a falha', async () => {
    const { store } = setup()
    await store.markFailed('a', 'dashboard', 'h')
    expect(await store.getState('a', 'dashboard', 'h')).toEqual({
      status: 'failed',
      at: 1_000_000,
    })
  })
})

describe('InsightsResultStore — uso recente', () => {
  it('lista só os apps com abertura dentro da validade, deste ambiente', async () => {
    const { store, advance, kv } = setup('bull')
    await store.touchLastOpen('a', 7 * 864e5)
    await store.touchLastOpen('b', 1000)
    await kv.set(makeInsightsKeys('staging').lastOpen('c'), '1')
    advance(2000)
    expect((await store.listRecentlyOpened()).sort()).toEqual(['a'])
  })
})
