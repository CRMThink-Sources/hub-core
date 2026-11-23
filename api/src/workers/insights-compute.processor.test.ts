import { describe, expect, it, vi } from 'vitest'
import {
  insightsQueryHash,
  makeInsightsKeys,
} from '@/modules/thinkzap/application/insights/insights-keys'
import { InsightsResultStore } from '@/modules/thinkzap/application/insights/insights-result-store'
import {
  fakeSource,
  session,
} from '@/modules/thinkzap/application/insights/insights-test-helpers'
import { INSIGHTS_CONFIG_DEFAULT } from '@/modules/thinkzap/domain/insights-config'
import { VibecodeAuthError } from '@/modules/thinkzap/infra/clients/vibecode.client'
import { MemoryInsightsKv } from '@/modules/thinkzap/infra/insights/memory-insights-kv'
import type { InsightsComputeJob } from '@/queue/insights-compute.queue'
import {
  processInsightsCompute,
  type InsightsComputeDeps,
} from './insights-compute.processor'

vi.mock('@/shared/infra/logger', () => {
  const l = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => l,
  }
  return { workerLogger: l, apiLogger: l }
})

const NOW = Date.parse('2026-11-18T15:00:00Z')
const dashboardJob: InsightsComputeJob = {
  kind: 'dashboard',
  appId: 'app-1',
  query: { from: '2026-11-10', to: '2026-11-10' },
}
const todayJob: InsightsComputeJob = {
  kind: 'today',
  appId: 'app-1',
  query: {},
}

function setup(over: Partial<InsightsComputeDeps> = {}) {
  const kv = new MemoryInsightsKv(() => NOW)
  const keys = makeInsightsKeys('bull')
  const store = new InsightsResultStore({ kv, keys, now: () => NOW })
  const { source } = fakeSource({
    mode: 'full',
    sessions: [
      session({
        id: 1,
        dateCreate: '2026-11-10T13:00:00.000Z',
        status: 'closed',
      }),
    ],
  })
  const resolve = vi.fn(() => Promise.resolve(source))
  const deps: InsightsComputeDeps = {
    store,
    getConfig: () => Promise.resolve(INSIGHTS_CONFIG_DEFAULT),
    makeSources: () => ({ resolve, onSourceFailure: () => false }),
    now: () => NOW,
    ...over,
  }
  return { deps, store, kv, keys, resolve }
}

describe('processInsightsCompute', () => {
  it('calcula o Desempenho, guarda o resultado e limpa o estado', async () => {
    const { deps, store } = setup()
    const hash = insightsQueryHash('dashboard', dashboardJob.query)
    await store.markComputing('app-1', 'dashboard', hash)

    const out = await processInsightsCompute(dashboardJob, deps)

    expect(out).toEqual({ stored: true })
    const got = await store.getResult<{ mode: string; kpi: { total: number } }>(
      'app-1',
      'dashboard',
      hash,
    )
    expect(got?.value.mode).toBe('full')
    expect(got?.value.kpi.total).toBe(1)
    expect(got?.fresh).toBe(true)
    expect(await store.getState('app-1', 'dashboard', hash)).toBeNull()
  })

  it('calcula o "Agora" com a mesma estrutura', async () => {
    const { deps, store } = setup()
    const hash = insightsQueryHash('today', todayJob.query)
    await processInsightsCompute(todayJob, deps)
    const got = await store.getResult<{ mode: string }>('app-1', 'today', hash)
    expect(got?.value.mode).toBe('full')
  })

  it('erro marca o estado como falho e relança (o BullMQ registra o job falho)', async () => {
    const { deps, store } = setup({
      getConfig: () => Promise.reject(new Error('banco fora')),
    })
    const hash = insightsQueryHash('dashboard', dashboardJob.query)

    await expect(processInsightsCompute(dashboardJob, deps)).rejects.toThrow(
      'banco fora',
    )

    expect(await store.getState('app-1', 'dashboard', hash)).toMatchObject({
      status: 'failed',
    })
    expect(await store.getResult('app-1', 'dashboard', hash)).toBeNull()
  })

  it('pré-aquecimento que falha não deixa erro para a tela (só o BullMQ e o log)', async () => {
    const { deps, store } = setup({
      getConfig: () => Promise.reject(new Error('banco fora')),
    })
    const hash = insightsQueryHash('dashboard', dashboardJob.query)

    await expect(
      processInsightsCompute({ ...dashboardJob, origin: 'prewarm' }, deps),
    ).rejects.toThrow('banco fora')

    expect(await store.getState('app-1', 'dashboard', hash)).toBeNull()
  })

  it('app invalidado durante o cálculo: o resultado é descartado', async () => {
    const { deps, store } = setup()
    const hash = insightsQueryHash('dashboard', dashboardJob.query)
    const resolve = vi.fn(async () => {
      // Salvar a configuração no meio da leitura.
      await store.invalidateApp('app-1')
      return fakeSource({ mode: 'full', sessions: [] }).source
    })
    deps.makeSources = () => ({ resolve, onSourceFailure: () => false })

    const out = await processInsightsCompute(dashboardJob, deps)

    expect(out).toEqual({ stored: false })
    expect(await store.getResult('app-1', 'dashboard', hash)).toBeNull()
  })

  it('chave revogada: refaz pelo clássico e guarda (a troca é nossa, não descarta)', async () => {
    const { deps, store } = setup()
    const hash = insightsQueryHash('dashboard', dashboardJob.query)
    const lean = fakeSource({
      mode: 'lean',
      sessions: [session({ id: 2, dateCreate: '2026-11-10T13:00:00.000Z' })],
    }).source
    let revoked = false
    const resolve = vi.fn(() =>
      Promise.resolve(
        revoked
          ? lean
          : ({
              ...lean,
              mode: 'full' as const,
              sessions: () => Promise.reject(new VibecodeAuthError(401)),
            } as typeof lean),
      ),
    )
    deps.makeSources = () => ({
      resolve,
      // O resolver real marca a chave e invalida o app: muda a geração.
      onSourceFailure: async () => {
        revoked = true
        await store.invalidateApp('app-1')
        return true
      },
    })

    const out = await processInsightsCompute(dashboardJob, deps)

    expect(out).toEqual({ stored: true })
    const got = await store.getResult<{ mode: string }>(
      'app-1',
      'dashboard',
      hash,
    )
    expect(got?.value.mode).toBe('lean')
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('erro que não é de chave não troca de fonte', async () => {
    const { deps } = setup()
    deps.makeSources = () => ({
      resolve: () => Promise.reject(new Error('Vibecode fora (503)')),
      onSourceFailure: () => false,
    })
    await expect(processInsightsCompute(dashboardJob, deps)).rejects.toThrow(
      '503',
    )
  })

  it('usa uma fonte nova a cada job (nada de mapa de processo)', async () => {
    const { deps } = setup()
    const makeSources = vi.fn(deps.makeSources)
    deps.makeSources = makeSources
    await processInsightsCompute(dashboardJob, deps)
    await processInsightsCompute(todayJob, deps)
    expect(makeSources).toHaveBeenCalledTimes(2)
  })

  it('falha de um cálculo já invalidado não vira erro para a próxima consulta', async () => {
    const { deps, store } = setup()
    const hash = insightsQueryHash('dashboard', dashboardJob.query)
    deps.makeSources = () => ({
      resolve: async () => {
        // A configuração é salva e, depois, a leitura antiga falha.
        await store.invalidateApp('app-1')
        throw new Error('Vibecode fora (503)')
      },
      onSourceFailure: () => false,
    })

    await expect(processInsightsCompute(dashboardJob, deps)).rejects.toThrow(
      '503',
    )

    expect(await store.getState('app-1', 'dashboard', hash)).toBeNull()
  })

  it('recusa da chave antiga, depois de a chave ser regravada, não marca a nova como revogada', async () => {
    const { deps, store } = setup()
    const marked = vi.fn(() => true)
    deps.makeSources = () => ({
      resolve: async () => {
        // O admin regrava a chave enquanto este cálculo ainda usa a antiga.
        await store.invalidateApp('app-1')
        throw new VibecodeAuthError(401)
      },
      onSourceFailure: marked,
    })

    await expect(
      processInsightsCompute(dashboardJob, deps),
    ).rejects.toBeInstanceOf(VibecodeAuthError)

    // O handler (que marca a chave e invalida o app) nem chega a ser chamado.
    expect(marked).not.toHaveBeenCalled()
  })

  it('resultado descartado por invalidação não apaga um "calculando" novo', async () => {
    const { deps, store } = setup()
    const hash = insightsQueryHash('dashboard', dashboardJob.query)
    deps.makeSources = () => ({
      resolve: async () => {
        await store.invalidateApp('app-1')
        // Uma abertura posterior já marcou um cálculo novo (de outro job).
        await store.markComputing('app-1', 'dashboard', hash)
        return fakeSource({ mode: 'full', sessions: [] }).source
      },
      onSourceFailure: () => false,
    })

    expect(await processInsightsCompute(dashboardJob, deps)).toEqual({
      stored: false,
    })

    expect(await store.getState('app-1', 'dashboard', hash)).toMatchObject({
      status: 'computing',
    })
  })
})
